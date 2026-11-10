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

const MateriasQuerySchema = z.object({
  dias: z.coerce.number().int().min(1).max(7).default(7),
});

/**
 * @openapi
 * /analytics/materias:
 *   get:
 *     tags: [Analytics]
 *     security:
 *       - schoolToken: []
 *     summary: Dúvidas por matéria no painel escolar
 *     description: >
 *       Retorna a contagem de turnos classificados por matéria para a escola
 *       autenticada, em uma janela de até 7 dias. Apenas aggregados — sem
 *       transcrições, respostas, identificadores de alunos ou de chamadas.
 *       Cache-Control: private, no-store.
 *     parameters:
 *       - in: query
 *         name: dias
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 7
 *           default: 7
 *         description: Janela de dias (1–7). Valores fora do intervalo retornam 400.
 *     responses:
 *       200:
 *         description: Aggregados de classificação por matéria
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsMaterias'
 *       400:
 *         description: Parâmetro inválido (dias fora do intervalo)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       401:
 *         description: Credencial de escola ausente ou inválida
 */
router.get(
  '/materias',
  validate({ query: MateriasQuerySchema }),
  analyticsController.materias,
);

export default router;
