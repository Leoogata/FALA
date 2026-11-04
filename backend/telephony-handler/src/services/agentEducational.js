// src/services/agentEducational.js — Cliente dos subagentes educacionais watsonx
'use strict';

const axios = require('axios');
const config = require('../config');

const WATSONX_BASE_URL = 'https://us-south.ml.cloud.ibm.com';
const WATSONX_API_VERSION = '2021-05-01';

/**
 * Obtém um token IAM IBM Cloud usando a WATSONX_API_KEY.
 */
async function getIamToken() {
  const response = await axios.post(
    'https://iam.cloud.ibm.com/identity/token',
    new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: config.watsonxApiKey,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

/**
 * Resolve o agentId watsonx para a campanhaId informada.
 * @param {string} campanhaId
 * @returns {string} agentId
 */
function resolveAgentId(campanhaId) {
  const agentId = config.watsonxAgentIds[campanhaId];
  if (!agentId) {
    throw new Error(`AgentId não configurado para campanhaId: ${campanhaId}`);
  }
  return agentId;
}

/**
 * Busca chunks relevantes no índice RAG do backend para uma campanha.
 *
 * Operação best-effort com timeout agressivo: se falhar ou demorar,
 * retorna null e o agente responde sem contexto (degradação graciosa).
 *
 * @param {string} campanhaId
 * @param {string} pergunta
 * @returns {Promise<string|null>} Texto concatenado dos chunks, ou null se falhar
 */
async function fetchRagContext(campanhaId, pergunta) {
  if (!config.backendApiUrl || !config.ragInternalToken) return null;

  try {
    const url = new URL('/rag/search', config.backendApiUrl);
    url.searchParams.set('campanhaId', campanhaId);
    url.searchParams.set('query', pergunta);

    const response = await axios.get(url.toString(), {
      timeout: config.ragTimeoutMs,
      headers: { Authorization: `Bearer ${config.ragInternalToken}` },
    });

    const resultados = response.data?.resultados ?? [];
    if (resultados.length === 0) return null;

    return resultados.map((r) => r.texto).join('\n\n');
  } catch (err) {
    console.warn(`[rag] Contexto indisponível para ${campanhaId}: ${err.message}`);
    return null;
  }
}

/**
 * Chama o subagente educacional correspondente à campanhaId.
 * Injeta o contexto RAG na pergunta antes de enviar ao watsonx (Context Injection).
 *
 * @param {{ campanhaId: string, pergunta: string }} params
 * @returns {Promise<{ resposta: string, confianca: number, sem_resposta: boolean }>}
 */
async function answerQuestion({ campanhaId, pergunta }) {
  const agentId = resolveAgentId(campanhaId);

  // Context Injection — busca chunks RAG em paralelo com o token IAM
  const [token, contextoRag] = await Promise.all([
    getIamToken(),
    fetchRagContext(campanhaId, pergunta),
  ]);

  // Monta a pergunta enriquecida com contexto (ou a pergunta original se sem contexto)
  const perguntaComContexto = contextoRag
    ? `Contexto dos documentos da campanha:\n${contextoRag}\n\nPergunta do aluno: ${pergunta}`
    : pergunta;

  const payload = {
    parameters: {
      prompt_variables: {
        input: JSON.stringify({ campanhaId, pergunta: perguntaComContexto }),
      },
    },
  };

  const response = await axios.post(
    `${WATSONX_BASE_URL}/ml/v1/deployments/${encodeURIComponent(agentId)}/text/generation?version=${WATSONX_API_VERSION}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const raw = response.data?.results?.[0]?.generated_text || response.data;
  const result = typeof raw === 'string' ? extractJson(raw) : raw;

  if (!result) {
    console.warn(`[agentEducational] Não foi possível extrair JSON da resposta: ${String(raw).slice(0, 200)}`);
    return { resposta: '', confianca: 0, sem_resposta: true };
  }

  return {
    resposta: result.resposta || '',
    confianca: typeof result.confianca === 'number' ? result.confianca : 0,
    sem_resposta: result.sem_resposta === true,
  };
}

/**
 * Extrai o primeiro objeto JSON VÁLIDO de uma string que pode conter prosa,
 * cercas de código, ou o mesmo objeto repetido/truncado. Varre candidatos
 * { ... } e retorna o primeiro que parseia e contém a chave `resposta`.
 */
function extractJson(texto) {
  const semCercas = String(texto).replace(/```(?:json)?/gi, '');
  for (let i = 0; i < semCercas.length; i++) {
    if (semCercas[i] !== '{') continue;
    for (let j = semCercas.lastIndexOf('}'); j > i; j = semCercas.lastIndexOf('}', j - 1)) {
      try {
        const obj = JSON.parse(semCercas.slice(i, j + 1));
        if (obj && typeof obj === 'object' && 'resposta' in obj) return obj;
      } catch {
        // tenta um '}' anterior
      }
    }
  }
  return null;
}

module.exports = { answerQuestion, resolveAgentId, fetchRagContext };
