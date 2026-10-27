import { Router } from 'express';
import { campanhasController } from '../controllers/campanhas.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  CriarCampanhaSchema,
  EditarCampanhaSchema,
  CampanhaIdSchema,
  ListarCampanhasQuerySchema,
  DeleteCampanhaQuerySchema,
} from '../schemas/campanha.schema.js';

const router = Router();

/**
 * @openapi
 * /campanhas:
 *   post:
 *     tags: [Campanhas]
 *     summary: Cria uma nova campanha
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Matemática — 9º ano EF
 *               descricao:
 *                 type: string
 *                 nullable: true
 *                 description: System prompt do agente educacional (opcional na criação)
 *                 example: Você é um tutor de matemática do ensino fundamental.
 *     responses:
 *       201:
 *         description: Campanha criada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Campanha'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post('/', validate({ body: CriarCampanhaSchema }), campanhasController.criar);

/**
 * @openapi
 * /campanhas:
 *   get:
 *     tags: [Campanhas]
 *     summary: Lista campanhas (com filtro opcional por status)
 *     parameters:
 *       - in: query
 *         name: ativa
 *         schema:
 *           type: boolean
 *         description: Filtra por campanhas ativas (true) ou inativas (false)
 *     responses:
 *       200:
 *         description: Lista de campanhas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Campanha'
 *                   - type: object
 *                     properties:
 *                       _count:
 *                         type: object
 *                         properties:
 *                           documentos:
 *                             type: integer
 */
router.get('/', validate({ query: ListarCampanhasQuerySchema }), campanhasController.listar);

/**
 * @openapi
 * /campanhas/{id}:
 *   get:
 *     tags: [Campanhas]
 *     summary: Detalha uma campanha com seus documentos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campanha encontrada
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Campanha'
 *                 - type: object
 *                   properties:
 *                     documentos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Documento'
 *       404:
 *         description: Campanha não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get('/:id', validate({ params: CampanhaIdSchema }), campanhasController.buscarPorId);

/**
 * @openapi
 * /campanhas/{id}:
 *   patch:
 *     tags: [Campanhas]
 *     summary: Edita nome e/ou status de uma campanha
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *               descricao:
 *                 type: string
 *                 nullable: true
 *                 description: System prompt do agente. Enviar null para limpar.
 *               ativa:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Campanha atualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Campanha'
 *       400:
 *         description: Dados inválidos ou body vazio
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
router.patch(
  '/:id',
  validate({ params: CampanhaIdSchema, body: EditarCampanhaSchema }),
  campanhasController.atualizar,
);

/**
 * @openapi
 * /campanhas/{id}:
 *   delete:
 *     tags: [Campanhas]
 *     summary: Remove uma campanha
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cascade
 *         schema:
 *           type: boolean
 *         description: >
 *           Se true, remove também todos os documentos e seus chunks no watsonx.
 *           Opt-in explícito — o default (false) protege contra remoção acidental.
 *     responses:
 *       204:
 *         description: Campanha removida
 *       404:
 *         description: Campanha não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       409:
 *         description: Campanha possui documentos (use ?cascade=true)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       502:
 *         description: Falha ao remover chunks no watsonx (cascade abortado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.delete(
  '/:id',
  validate({ params: CampanhaIdSchema, query: DeleteCampanhaQuerySchema }),
  campanhasController.remover,
);

export default router;
