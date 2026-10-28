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
 * Chama o subagente educacional correspondente à campanhaId.
 *
 * @param {{ campanhaId: string, pergunta: string }} params
 * @returns {Promise<{ resposta: string, confianca: number, sem_resposta: boolean }>}
 */
async function answerQuestion({ campanhaId, pergunta }) {
  const agentId = resolveAgentId(campanhaId);
  const token = await getIamToken();

  const payload = {
    parameters: {
      prompt_variables: {
        input: JSON.stringify({ campanhaId, pergunta }),
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
  const result = typeof raw === 'string'
    ? JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
    : raw;

  return {
    resposta: result.resposta || '',
    confianca: typeof result.confianca === 'number' ? result.confianca : 0,
    sem_resposta: result.sem_resposta === true,
  };
}

module.exports = { answerQuestion, resolveAgentId };
