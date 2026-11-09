import { z } from 'zod';
import { env } from '../config/env.js';
import { watsonxPost } from './watsonx.service.js';
import { watsonxClient } from '../rag/watsonxClient.js';
import { sanitizar } from '../utils/sanitizacao.js';
import { createError } from '../middlewares/errorHandler.js';

// Schema tolerante: valida os TIPOS, mas em vez de rejeitar quando os campos
// se contradizem (ex.: sem_resposta=true porém resposta preenchida), NORMALIZA
// para um estado coerente. Objetivo: o pipeline nunca quebrar (502/ligação
// caindo) por causa de um agente que não segue o contrato à risca. Campos
// ausentes recebem defaults seguros.
const outputSchema = z.object({
  resposta: z.string().max(2000).optional().default(''),
  confianca: z.number().min(0).max(1).optional().default(0),
  sem_resposta: z.boolean().optional().default(false),
  precisa_esclarecimento: z.boolean().optional().default(false),
  pergunta_esclarecimento: z.string().max(500).optional().default(''),
}).transform((r) => {
  // Se pede esclarecimento, implica que não respondeu de fato.
  const precisaEsclarecimento = r.precisa_esclarecimento && !!r.pergunta_esclarecimento.trim();
  // sem_resposta vale se o modelo marcou OU se não produziu texto de resposta.
  const semResp = r.sem_resposta || precisaEsclarecimento || !r.resposta.trim();
  return {
    // Quando é "sem resposta", não falamos a resposta (pode conter recusa/ruído);
    // o handler usa o fallback. Quando há resposta, mantemos o texto.
    resposta: semResp ? '' : r.resposta.trim(),
    confianca: semResp ? 0 : r.confianca,
    sem_resposta: semResp,
    precisa_esclarecimento: precisaEsclarecimento,
    pergunta_esclarecimento: precisaEsclarecimento ? r.pergunta_esclarecimento.trim() : '',
  };
});

/**
 * Extrai o PRIMEIRO objeto JSON completo e balanceado de uma string.
 * Necessário porque o modelo às vezes ecoa o input depois da resposta
 * (ex.: `{...resposta...}\n\nEntrada:\n{...}`), o que quebra um parse ingênuo.
 * Respeita chaves dentro de strings e escapes.
 */
function primeiroObjetoJson(str) {
  const inicio = str.indexOf('{');
  if (inicio === -1) return null;
  let profundidade = 0;
  let emString = false;
  let escape = false;
  for (let k = inicio; k < str.length; k++) {
    const c = str[k];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { emString = !emString; continue; }
    if (emString) continue;
    if (c === '{') profundidade++;
    else if (c === '}') {
      profundidade--;
      if (profundidade === 0) return str.slice(inicio, k + 1);
    }
  }
  return null; // não fechou — deixa o parse falhar e cair em semResposta
}

export function parseAnswer(raw) {
  try {
    let text = typeof raw === 'string' ? raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : raw;
    if (typeof text === 'string') {
      const objeto = primeiroObjetoJson(text);
      text = JSON.parse(objeto ?? text);
    }
    return outputSchema.parse(text);
  } catch (err) {
    // Resposta irrecuperável (nem JSON é) — NÃO derruba a ligação: cai no
    // "sem resposta", e o handler reproduz o fallback de voz. Loga o cru para
    // diagnóstico de agentes mal comportados.
    console.error('[educational] parseAnswer falhou — usando sem_resposta. Cru:',
      typeof raw === 'string' ? raw.slice(0, 500) : JSON.stringify(raw)?.slice(0, 500));
    console.error('[educational] motivo:', err?.message);
    return semResposta();
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
    parameters: {
      prompt_variables: { input: JSON.stringify(input) },
      // LATÊNCIA: o tempo do LLM é proporcional aos tokens gerados. A resposta
      // é um JSON curto (lido por telefone) — limitar os tokens corta a espera
      // e evita que o modelo continue gerando o eco do input.
      max_new_tokens: 256,
      min_new_tokens: 1,
      // Para após fechar o objeto JSON — impede o eco de "Entrada:" depois dele.
      stop_sequences: ['\n\nEntrada:', '\n\nEntrada', '}\n\n'],
    },
    // O filtro HAP do watsonx dá falsos positivos em material didático legítimo
    // (ex.: "pontuação máxima é dez pontos") e bloqueia a geração, retornando
    // texto vazio. Desligamos a moderação HAP em entrada e saída — o conteúdo
    // já é escolar e passa pela nossa própria sanitização.
    moderations: {
      hap: { input: { enabled: false }, output: { enabled: false } },
    },
  });
  const result = parseAnswer(data.results?.[0]?.generated_text);
  const resposta = sanitizar(result.resposta);
  const esclarecimento = sanitizar(result.pergunta_esclarecimento);
  if (resposta.suprimido || esclarecimento.suprimido) return semResposta();
  return { ...result, resposta: resposta.texto ?? '', pergunta_esclarecimento: esclarecimento.texto ?? '',
    fontes: result.sem_resposta ? [] : resultados.map(({ documentoId, trechoId, nomeDocumento }) =>
      ({ documentoId, trechoId, nomeDocumento })) };
}
