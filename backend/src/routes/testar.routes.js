import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { campanhasService } from '../services/campanhas.service.js';
import { gerarResposta } from '../services/educational.service.js';

const router = Router({ mergeParams: true });
router.post('/', validate({ body: z.object({
  pergunta: z.string().trim().min(1).max(500),
  historico: z.array(z.object({ pergunta: z.string().max(500), resposta: z.string().max(1000) })).max(5).default([]),
}) }), async (req, res, next) => {
  try {
    const agente = await campanhasService.buscarPorId(req.params.id);
    res.json(await gerarResposta({ agente: { ...agente, modo: 'escola' }, ...req.body }));
  } catch (err) { next(err); }
});
export default router;
