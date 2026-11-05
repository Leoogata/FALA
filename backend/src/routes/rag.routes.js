import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { requireInternalToken } from '../middlewares/requireInternalToken.js';
import { env } from '../config/env.js';
import { campanhasRepository } from '../repositories/campanhas.repository.js';
import { createError } from '../middlewares/errorHandler.js';

const router = Router();

const RagSearchQuerySchema = z.object({
  campanhaId: z.string().min(1, 'campanhaId é obrigatório'),
  query: z
    .string()
    .min(1, 'query é obrigatória')
    .max(500, 'query excede 500 caracteres'),
  topK: z.coerce.number().int().positive().max(20).optional(),
});

/**
 * @openapi
 * /rag/search:
 *   get:
 *     tags: [RAG]
 *     summary: Busca chunks relevantes no índice RAG de uma campanha
 *     description: >
 *       Endpoint interno — consumido pelo telephony-handler para injetar contexto
 *       no subagente educacional antes de chamar o watsonx (Context Injection).
 *       Requer header `Authorization: Bearer <RAG_INTERNAL_TOKEN>`.
 *       O isolamento por campanha é garantido — uma busca nunca retorna chunks de outra campanha.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: campanhaId
 *         required: true
 *         schema:
 *           type: string
 *           example: matematica
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           example: O que é equação do segundo grau?
 *       - in: query
 *         name: topK
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *         description: Número de chunks a retornar (default configurado em RAG_SEARCH_TOP_K)
 *     responses:
 *       200:
 *         description: Chunks relevantes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resultados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       documentoId:
 *                         type: string
 *                       texto:
 *                         type: string
 *                       score:
 *                         type: number
 *                         format: float
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       401:
 *         description: Token ausente ou inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get(
  '/search',
  requireInternalToken,
  validate({ query: RagSearchQuerySchema }),
  async (req, res, next) => {
    try {
      const { campanhaId, query, topK } = req.query;
      const campanha = await campanhasRepository.buscarAtivaPorReferencia(campanhaId);
      if (!campanha) throw createError(404, 'Campanha ativa não encontrada');
      const { watsonxClient } = await import('../rag/watsonxClient.js');
      const resultado = await watsonxClient.search(
        campanha.id,
        query,
        { topK: topK ?? env.RAG_SEARCH_TOP_K },
      );
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
