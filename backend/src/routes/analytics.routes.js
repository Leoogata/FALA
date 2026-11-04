import { Router } from 'express';
import { z } from 'zod';
import { analyticsController } from '../controllers/analytics.controller.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const AnalyticsQuerySchema = z.object({
  dias: z.coerce.number().int().positive().max(90).default(30),
  top: z.coerce.number().int().positive().max(50).default(10),
});

const AnalyticsCampanhaIdSchema = z.object({
  campanhaId: z.string().min(1, 'campanhaId é obrigatório'),
});

/**
 * @openapi
 * /analytics/campanhas/{campanhaId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Dados agregados de uma campanha para o dashboard
 *     description: >
 *       Retorna métricas anônimas e agregadas de uma campanha.
 *       Nenhuma query retorna registros individuais — apenas contagens e percentuais.
 *     parameters:
 *       - in: path
 *         name: campanhaId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [historia, geografia, portugues, matematica, ciencias]
 *         example: matematica
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 90
 *           default: 30
 *         description: Janela de dias para volumePorDia
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de perguntas no topPerguntas
 *     responses:
 *       200:
 *         description: Dados agregados da campanha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsCampanha'
 *       400:
 *         description: Parâmetro inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get(
  '/campanhas/:campanhaId',
  validate({ params: AnalyticsCampanhaIdSchema, query: AnalyticsQuerySchema }),
  analyticsController.campanhas,
);

export default router;
