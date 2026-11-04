import { Router } from 'express';
import { interacoesController } from '../controllers/interacoes.controller.js';
import { validate } from '../middlewares/validate.js';
import { InteracaoSchema } from '../schemas/interacao.schema.js';

const router = Router();

/**
 * @openapi
 * /interacoes:
 *   post:
 *     tags: [Analytics]
 *     summary: Registra uma interação de voz (fire-and-forget do telephony-handler)
 *     description: >
 *       Persiste um turno de ligação de forma estritamente anônima.
 *       Rejeita com 422 qualquer payload que contenha CPF ou telefone em
 *       `pergunta` ou `resposta` (requisito de privacidade da competição IBM).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [campanha_id, pergunta, sem_resposta, call_sid]
 *             properties:
 *               campanha_id:
 *                 type: string
 *                 example: matematica
 *                 description: Slug semântico da campanha
 *               pergunta:
 *                 type: string
 *                 example: O que é equação do segundo grau?
 *               resposta:
 *                 type: string
 *                 nullable: true
 *                 example: É uma equação polinomial de grau 2...
 *               score_confianca_stt:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 nullable: true
 *               score_confianca_agente:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 maximum: 1
 *                 nullable: true
 *               sem_resposta:
 *                 type: boolean
 *                 default: false
 *               call_sid:
 *                 type: string
 *                 example: CA0123456789abcdef0123456789abcdef
 *     responses:
 *       201:
 *         description: Interação registrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 criadoEm:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Campos obrigatórios ausentes ou tipo inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Payload contém dado pessoal identificável (CPF ou telefone)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.post('/', validate({ body: InteracaoSchema }), interacoesController.registrar);

export default router;
