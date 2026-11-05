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
 * Chama o subagente educacional correspondente à campanhaId.
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
  const token = await getIamToken();

  const payload = {
    parameters: {
      prompt_variables: {
        input: JSON.stringify({ campanhaId, pergunta, historico }),
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

module.exports = { answerQuestion, resolveAgentId };
