// src/services/orchestrator.js — Cliente do agente orquestrador watsonx
'use strict';

const axios = require('axios');
const config = require('../config');
const { parseModelResponse, validConfidence } = require('./modelResponse');

const WATSONX_BASE_URL = 'https://us-south.ml.cloud.ibm.com';
const WATSONX_API_VERSION = '2021-05-01';
const CAMPANHAS_SUPORTADAS = new Set(['historia', 'geografia', 'portugues', 'matematica', 'ciencias']);

/**
 * Obtém um token IAM IBM Cloud usando a WATSONX_API_KEY.
 * Em produção, considere cachear o token até próxima expiração.
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
 * Chama o agente orquestrador watsonx para identificar a campanha da pergunta.
 *
 * @param {{ pergunta: string, campanhasAtivas: Array }} params
 * @returns {Promise<{ campanhaId: string, confianca: number, sem_rota: boolean }>}
 */
async function routeQuestion({ pergunta, campanhasAtivas }) {
  const token = await getIamToken();

  const payload = {
    parameters: {
      prompt_variables: {
        input: JSON.stringify({ pergunta, campanhasAtivas }),
      },
    },
  };

  const response = await axios.post(
    `${WATSONX_BASE_URL}/ml/v1/deployments/${encodeURIComponent(config.watsonxOrchestratorId)}/text/generation?version=${WATSONX_API_VERSION}`,
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

  if (!validConfidence(result.confianca) || typeof result.sem_rota !== 'boolean') {
    throw new Error('Resposta inválida do orquestrador');
  }

  if (!CAMPANHAS_SUPORTADAS.has(result?.campanhaId) ||
      !campanhasAtivas.some((campanha) => campanha.campanhaId === result.campanhaId)) {
    throw new Error('O orquestrador retornou um ID de campanha inválido ou inativo');
  }

  return {
    campanhaId: result.campanhaId,
    confianca: result.confianca,
    sem_rota: result.sem_rota,
  };
}

module.exports = { routeQuestion };
