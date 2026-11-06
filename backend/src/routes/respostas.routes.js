import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import { internalAuth } from '../middlewares/internalAuth.js';
import { validate } from '../middlewares/validate.js';
import { createError } from '../middlewares/errorHandler.js';
import { agenteDaConversa } from '../services/agentConfig.service.js';
import { gerarResposta } from '../services/educational.service.js';
import { buscarContexto } from '../repositories/conversas.repository.js';
import { env } from '../config/env.js';

const router = Router();
/**
 * @openapi
 * /internal/respostas:
 *   post:
 *     summary: Gera resposta usando o agente, a pergunta e o histórico persistidos
 *     tags: [Conversas]
 *     security: [{ internalAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversa_id, turno_token]
 *             properties:
 *               conversa_id: { type: string, format: uuid }
 *               turno_token: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resposta validada do agente, com fontes e versão do prompt
 */
router.post('/', internalAuth, validate({ body: z.object({
  conversa_id: z.string().uuid(), turno_token: z.string().uuid(),
}) }), async (req, res, next) => {
  try {
    const conversa = await prisma.conversa.findUnique({ where: { id: req.body.conversa_id } });
    if (!conversa || conversa.estado !== 'ATIVA' || conversa.expira_em <= new Date()) {
      throw createError(410, 'Conversa indisponível');
    }
    const turno = await prisma.interacao.findUnique({ where: { turno_token: req.body.turno_token } });
    if (!turno || turno.conversa_id !== conversa.id || turno.status !== 'RECEBIDO' || turno.expira_em <= new Date()) {
      throw createError(409, 'Turno não disponível nesta conversa');
    }
    const agente = await agenteDaConversa(conversa);
    const historico = await buscarContexto(conversa.id);
    const resultado = await gerarResposta({ agente, pergunta: turno.texto_suprimido ? null : turno.pergunta, historico });
    res.json({ ...resultado, campanha_id: agente.id, versao_prompt: env.VERSAO_PROMPT });
  } catch (err) { next(err); }
});
export default router;
