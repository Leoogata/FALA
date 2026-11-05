// src/services/agentEducational.js — Cliente dos subagentes educacionais watsonx
'use strict';

const axios = require('axios');
const config = require('../config');
const { parseModelResponse, validConfidence } = require('./modelResponse');

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
 * @param {{ campanhaId: string, pergunta: string, historico?: Array }} params
 * @returns {Promise<{
 *   resposta: string,
 *   confianca: number,
 *   sem_resposta: boolean,
 *   precisa_esclarecimento: boolean,
 *   pergunta_esclarecimento: string
 * }>}
 */
async function answerQuestion({ campanhaId, pergunta, historico = [] }) {
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
        input: JSON.stringify({ campanhaId, pergunta: perguntaComContexto, historico }),
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

  const raw = response.data?.results?.[0]?.generated_text ?? response.data;
  const result = parseModelResponse(raw);

  const precisaEsclarecimento = result.precisa_esclarecimento === true;
  const perguntaEsclarecimento = typeof result.pergunta_esclarecimento === 'string'
    ? result.pergunta_esclarecimento.slice(0, 300)
    : '';

  // Quando precisa_esclarecimento, espera-se resposta vazia, confiança 0, sem_resposta true
  if (precisaEsclarecimento) {
    if (result.resposta !== '' || result.confianca !== 0 || result.sem_resposta !== true) {
      throw new Error('Resposta inválida do subagente: precisa_esclarecimento requer resposta vazia');
    }
    if (!perguntaEsclarecimento) {
      throw new Error('precisa_esclarecimento=true mas pergunta_esclarecimento ausente');
    }
  } else if (typeof result.resposta !== 'string' || result.resposta.length > 1000 ||
      !validConfidence(result.confianca) || typeof result.sem_resposta !== 'boolean' ||
      (result.sem_resposta ? result.resposta !== '' || result.confianca !== 0 : !result.resposta.trim())) {
    throw new Error('Resposta inválida do subagente educacional');
  }

  return {
    resposta: result.resposta,
    confianca: result.confianca,
    sem_resposta: result.sem_resposta,
    precisa_esclarecimento: precisaEsclarecimento,
    pergunta_esclarecimento: perguntaEsclarecimento,
  };
}

module.exports = { answerQuestion, resolveAgentId, fetchRagContext };
