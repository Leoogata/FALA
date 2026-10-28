import { Router } from 'express';
import { campanhasService } from '../services/campanhas.service.js';

const router = Router({ mergeParams: true });

/**
 * POST /campanhas/:id/testar
 *
 * Stub: simula uma resposta do agente para fins de teste no painel.
 * Futuramente chamará o pipeline RAG real do watsonx.
 *
 * Body: { pergunta: string }
 * Response: { resposta: string, confianca: number, sem_resposta: boolean }
 */
router.post('/', async (req, res, next) => {
  try {
    const campanha = await campanhasService.buscarPorId(req.params.id);
    const { pergunta = '' } = req.body ?? {};

    if (!pergunta.trim()) {
      return res.status(400).json({ error: 'O campo "pergunta" é obrigatório.' });
    }

    // Stub simples — retorna sem_resposta=true até a integração RAG estar pronta
    res.json({
      resposta: `O agente "${campanha.nome}" ainda está sendo integrado ao pipeline de IA. Tente novamente em breve.`,
      confianca: 0,
      sem_resposta: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
