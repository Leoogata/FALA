// src/routes/conversas.routes.js — Rotas internas de conversas e interações
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { internalAuth } from '../middlewares/internalAuth.js';
import {
  postConversa,
  getContexto,
  postTurno,
  patchConversa,
} from '../controllers/conversas.controller.js';
import {
  criarConversaSchema,
  reservarTurnoSchema,
  encerrarConversaSchema,
} from '../schemas/conversa.schema.js';

const router = Router();

// Todos os endpoints internos exigem autenticação de serviço
router.use(internalAuth);

/**
 * @openapi
 * /internal/conversas:
 *   post:
 *     summary: Cria ou recupera uma conversa pela chave HMAC
 *     tags: [Conversas]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', validate({ body: criarConversaSchema }), postConversa);

/**
 * @openapi
 * /internal/conversas/{id}/contexto:
 *   get:
 *     summary: Retorna as últimas trocas elegíveis para os agentes
 *     tags: [Conversas]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id/contexto', getContexto);

/**
 * @openapi
 * /internal/conversas/{id}/turnos:
 *   post:
 *     summary: Reserva um turno (pergunta sanitizada + token de idempotência)
 *     tags: [Conversas]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:id/turnos', validate({ body: reservarTurnoSchema }), postTurno);

/**
 * @openapi
 * /internal/conversas/{id}:
 *   patch:
 *     summary: Encerra uma conversa explicitamente
 *     tags: [Conversas]
 *     security: [{ bearerAuth: [] }]
 */
router.patch('/:id', validate({ body: encerrarConversaSchema }), patchConversa);

export default router;
