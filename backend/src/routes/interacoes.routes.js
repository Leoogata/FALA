// Persistência confirmada e compatibilidade com o contrato anterior de analytics.
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { internalAuth } from '../middlewares/internalAuth.js';
import { postInteracao } from '../controllers/conversas.controller.js';
import { concluirTurnoSchema } from '../schemas/conversa.schema.js';
import { interacoesController } from '../controllers/interacoes.controller.js';
import { InteracaoSchema } from '../schemas/interacao.schema.js';

const router = Router();
router.use(internalAuth);

/**
 * @openapi
 * /interacoes:
 *   post:
 *     summary: Finaliza um turno de conversa ou recebe o contrato legado de analytics
 *     tags: [Interações]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/', (req, res, next) => {
  const body = req.body ?? {};
  const conversa = Object.hasOwn(body, 'conversa_id') || Object.hasOwn(body, 'turno_token');
  const schema = conversa ? concluirTurnoSchema : InteracaoSchema;
  const handler = conversa ? postInteracao : interacoesController.registrar;
  return validate({ body: schema })(req, res, () => handler(req, res, next));
});

export default router;
