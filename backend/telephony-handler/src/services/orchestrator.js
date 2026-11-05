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
 * @param {{ pergunta: string, campanhasAtivas: Array, historico?: Array }} params
 * @returns {Promise<{
 *   campanhaId: string,
 *   confianca: number,
 *   sem_rota: boolean,
 *   precisa_esclarecimento: boolean,
 *   pergunta_esclarecimento: string
 * }>}
 */
async function routeQuestion({ pergunta, campanhasAtivas, historico = [] }) {
  const token = await getIamToken();

  const payload = {
    parameters: {
      prompt_variables: {
        input: JSON.stringify({ pergunta, campanhasAtivas, historico }),
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

  // Validar campos de esclarecimento (novos campos com retrocompatibilidade)
  const precisaEsclarecimento = result.precisa_esclarecimento === true;
  const perguntaEsclarecimento = typeof result.pergunta_esclarecimento === 'string'
    ? result.pergunta_esclarecimento.slice(0, 300)
    : '';

  if (precisaEsclarecimento && !perguntaEsclarecimento) {
    throw new Error('precisa_esclarecimento=true mas pergunta_esclarecimento ausente');
  }

  if (!CAMPANHAS_SUPORTADAS.has(result?.campanhaId) ||
      !campanhasAtivas.some((campanha) => campanha.campanhaId === result.campanhaId)) {
    throw new Error('O orquestrador retornou um ID de campanha inválido ou inativo');
  }

  return {
    campanhaId: result.campanhaId,
    confianca: result.confianca,
    sem_rota: result.sem_rota,
    precisa_esclarecimento: precisaEsclarecimento,
    pergunta_esclarecimento: perguntaEsclarecimento,
  };
}

/**
 * Extrai o primeiro objeto JSON VÁLIDO de uma string que pode conter prosa,
 * cercas de código, ou o mesmo objeto repetido várias vezes (o modelo às vezes
 * repete ou trunca). Varre candidatos { ... } e retorna o primeiro que parseia
 * e contém a chave `campanhaId`. Null se nenhum servir.
 */
function extractJson(texto) {
  const semCercas = String(texto).replace(/```(?:json)?/gi, '');
  // Varre cada posição de '{' e tenta fechar num objeto parseável,
  // avançando pelo último '}' e recuando até achar um JSON válido.
  for (let i = 0; i < semCercas.length; i++) {
    if (semCercas[i] !== '{') continue;
    for (let j = semCercas.lastIndexOf('}'); j > i; j = semCercas.lastIndexOf('}', j - 1)) {
      try {
        const obj = JSON.parse(semCercas.slice(i, j + 1));
        if (obj && typeof obj === 'object' && 'campanhaId' in obj) return obj;
      } catch {
        // tenta um '}' anterior
      }
    }
  }
  return null;
}

module.exports = { routeQuestion };
