import { Router } from 'express';
import multer from 'multer';
import { documentosController } from '../controllers/documentos.controller.js';
import { upload } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';
import {
  DocumentoParamsSchema,
  DocumentoUploadParamsSchema,
  ListarDocumentosQuerySchema,
} from '../schemas/documento.schema.js';

const router = Router({ mergeParams: true });

/**
 * Wrapper do Multer que transforma erros em respostas HTTP padronizadas.
 * MulterError LIMIT_FILE_SIZE → 400
 * Erros do fileFilter (tipo inválido) → 400
 */
function handleUpload(req, res, next) {
  upload.single('arquivo')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `Arquivo excede o tamanho máximo permitido.`,
        });
      }
      return res.status(400).json({ error: err.message });
    }

    // Erro do fileFilter (tipo não permitido) — já tem status 400 embutido
    if (err.status) return res.status(err.status).json({ error: err.message });

    next(err);
  });
}

/**
 * @openapi
 * /campanhas/{id}/documentos:
 *   get:
 *     tags: [Documentos]
 *     summary: Lista documentos de uma campanha com filtro opcional por status
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PROCESSANDO, PRONTO, ERRO]
 *         description: Filtra documentos pelo status de indexação
 *     responses:
 *       200:
 *         description: Lista de documentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Documento'
 *       404:
 *         description: Campanha não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get(
  '/',
  validate({ params: DocumentoUploadParamsSchema, query: ListarDocumentosQuerySchema }),
  documentosController.listar,
);

/**
 * @openapi
 * /campanhas/{id}/documentos/{docId}:
 *   get:
 *     tags: [Documentos]
 *     summary: Detalha um documento — útil para monitorar o status de indexação
 *     description: >
 *       Inclui `erroIndexacao` quando o status for ERRO,
 *       permitindo diagnóstico sem consultar logs do servidor.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do documento
 *     responses:
 *       200:
 *         description: Documento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Documento'
 *       404:
 *         description: Campanha ou documento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get(
  '/:docId',
  validate({ params: DocumentoParamsSchema }),
  documentosController.buscarPorId,
);

/**
 * @openapi
 * /campanhas/{id}/documentos:
 *   post:
 *     tags: [Documentos]
 *     summary: Faz upload de um documento (PDF ou TXT) para uma campanha
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [arquivo]
 *             properties:
 *               arquivo:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo PDF ou TXT (máximo configurável via MAX_UPLOAD_SIZE_MB)
 *     responses:
 *       201:
 *         description: Documento criado — indexação em andamento (status PROCESSANDO)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Documento'
 *       400:
 *         description: Tipo de arquivo inválido ou tamanho excedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404:
 *         description: Campanha não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post(
  '/',
  validate({ params: DocumentoUploadParamsSchema }),
  handleUpload,
  documentosController.upload,
);

/**
 * @openapi
 * /campanhas/{id}/documentos/{docId}:
 *   delete:
 *     tags: [Documentos]
 *     summary: Remove um documento e seus chunks do índice watsonx
 *     description: >
 *       Permitido mesmo se o documento estiver em status PROCESSANDO.
 *       O pipeline detecta o registro ausente e descarta o resultado silenciosamente.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da campanha
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do documento
 *     responses:
 *       204:
 *         description: Documento removido
 *       404:
 *         description: Campanha ou documento não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       502:
 *         description: Falha ao remover chunks no watsonx — documento não removido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete(
  '/:docId',
  validate({ params: DocumentoParamsSchema }),
  documentosController.remover,
);

export default router;
