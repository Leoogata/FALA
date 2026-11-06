import { z } from 'zod';
import { env } from '../config/env.js';
import { watsonxPost } from './watsonx.service.js';
import { watsonxClient } from '../rag/watsonxClient.js';
import { sanitizar } from '../utils/sanitizacao.js';
import { createError } from '../middlewares/errorHandler.js';

const outputSchema = z.object({
  resposta: z.string().max(1000), confianca: z.number().min(0).max(1), sem_resposta: z.boolean(),
  precisa_esclarecimento: z.boolean(), pergunta_esclarecimento: z.string().max(300),
}).superRefine((r, ctx) => {
  if ((r.sem_resposta && (r.resposta !== '' || r.confianca !== 0)) ||
      (!r.sem_resposta && !r.resposta.trim()) ||
      (r.precisa_esclarecimento && (!r.sem_resposta || !r.pergunta_esclarecimento.trim())) ||
      (!r.precisa_esclarecimento && r.pergunta_esclarecimento !== '')) {
    ctx.addIssue({ code: 'custom', message: 'Contrato de resposta inconsistente' });
  }
});

export function parseAnswer(raw) {
  try {
    const text = typeof raw === 'string' ? raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : raw;
    return outputSchema.parse(typeof text === 'string' ? JSON.parse(text) : text);
  } catch {
    throw createError(502, 'Resposta inválida do agente educacional');
  }
}

export const semResposta = () => ({ resposta: '', confianca: 0, sem_resposta: true,
  precisa_esclarecimento: false, pergunta_esclarecimento: '', fontes: [] });

export async function gerarResposta({ agente, pergunta, historico = [] }) {
  const clean = sanitizar(pergunta);
  if (clean.suprimido || !clean.texto?.trim()) return semResposta();
  const history = historico.slice(-env.CONTEXT_MAX_TURNS).map((t) => ({
    pergunta: sanitizar(t.pergunta).texto?.slice(0, 500) ?? '',
    resposta: sanitizar(t.resposta).texto?.slice(0, 1000) ?? '',
  }));
  // Limite de contexto preservando as trocas mais recentes.
  while (history.length && JSON.stringify(history).length > env.CONTEXT_MAX_CHARS) history.shift();
  let resultados = [];
  if (agente.modo === 'escola') {
    if (!agente.escolaId || !agente.id || !agente.usaRag) throw createError(409, 'Configuração escolar inválida');
    // Referências curtas como "e por quê?" precisam do assunto da última troca.
    const query = `${history.slice(-1).map((t) => `${t.pergunta} ${t.resposta}`).join(' ')} ${clean.texto}`.slice(-2000);
    ({ resultados } = await watsonxClient.search(agente.id, query, { escolaId: agente.escolaId, topK: env.RAG_SEARCH_TOP_K }));
    if (!resultados.length) return semResposta();
  }
  const input = {
    modo: agente.modo, instrucoes: agente.descricao ?? '',
    contexto_rag: resultados.map((r) => r.texto).join('\n\n').slice(0, 12000),
    historico: history, pergunta: clean.texto,
  };
  // Geração real mesmo se WATSONX_MOCK=true: esse sinalizador simula somente o índice RAG.
  const data = await watsonxPost(`/ml/v1/deployments/${encodeURIComponent(env.WATSONX_DEPLOYMENT_ID)}/text/generation`, {
    parameters: { prompt_variables: { input: JSON.stringify(input) } },
  });
  const result = parseAnswer(data.results?.[0]?.generated_text);
  const resposta = sanitizar(result.resposta);
  const esclarecimento = sanitizar(result.pergunta_esclarecimento);
  if (resposta.suprimido || esclarecimento.suprimido) return semResposta();
  return { ...result, resposta: resposta.texto ?? '', pergunta_esclarecimento: esclarecimento.texto ?? '',
    fontes: result.sem_resposta ? [] : resultados.map(({ documentoId, trechoId, nomeDocumento }) =>
      ({ documentoId, trechoId, nomeDocumento })) };
}
