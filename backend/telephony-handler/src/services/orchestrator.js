// src/services/orchestrator.js — Cliente do agente orquestrador watsonx
'use strict';

const axios = require('axios');
const config = require('../config');

const WATSONX_BASE_URL = 'https://us-south.ml.cloud.ibm.com';
const WATSONX_API_VERSION = '2021-05-01';

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
 * @returns {Promise<{ campanhaId: string|null, confianca: number, sem_rota: boolean }>}
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

  // O prompt pede JSON puro, mas o modelo às vezes inclui prosa antes/depois
  // (ex: "Ou seja, {...}"). extractJson() isola o primeiro objeto JSON da
  // resposta, tornando o roteamento resiliente a texto extra.
  const raw = response.data?.results?.[0]?.generated_text || response.data;
  const result = typeof raw === 'string' ? extractJson(raw) : raw;

  if (!result) {
    console.warn(`[orchestrator] Não foi possível extrair JSON da resposta: ${String(raw).slice(0, 200)}`);
    return { campanhaId: null, confianca: 0, sem_rota: true };
  }

  return {
    campanhaId: result.campanhaId ?? null,
    confianca: typeof result.confianca === 'number' ? result.confianca : 0,
    sem_rota: result.sem_rota === true,
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
