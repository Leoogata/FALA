// src/routes/interacoes.routes.js — POST /interacoes (conclusão confirmada de turno)
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { internalAuth } from '../middlewares/internalAuth.js';
import { postInteracao } from '../controllers/conversas.controller.js';
import { concluirTurnoSchema } from '../schemas/conversa.schema.js';

const router = Router();

router.use(internalAuth);

/**
 * @openapi
 * /interacoes:
 *   post:
 *     summary: Finaliza um turno com resultado do processamento (substitui o fire-and-forget)
 *     tags: [Interações]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', validate(concluirTurnoSchema), postInteracao);

export default router;
