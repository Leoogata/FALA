import { env } from '../config/env.js';
import { createError } from '../middlewares/errorHandler.js';

let tokenCache;
let tokenRequest;

async function jsonRequest(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(env.WATSONX_TIMEOUT_MS) });
  if (!response.ok) throw createError(502, `Serviço IBM indisponível (${response.status})`);
  return response.json();
}

export async function iamToken() {
  if (!env.WATSONX_API_KEY) throw createError(503, 'WATSONX_API_KEY não configurada no backend');
  if (tokenCache?.expires > Date.now()) return tokenCache.value;
  if (!tokenRequest) {
    tokenRequest = jsonRequest('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ibm:params:oauth:grant-type:apikey', apikey: env.WATSONX_API_KEY }),
    }).then((data) => {
      if (!data.access_token) throw createError(502, 'Token IBM inválido');
      tokenCache = { value: data.access_token, expires: Date.now() + Math.max(0, (data.expires_in ?? 300) - 60) * 1000 };
      return tokenCache.value;
    }).finally(() => { tokenRequest = null; });
  }
  return tokenRequest;
}

export async function watsonxPost(path, payload, version = '2021-05-01') {
  const token = await iamToken();
  return jsonRequest(`${env.WATSONX_URL.replace(/\/$/, '')}${path}?version=${version}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function embedTexts(inputs) {
  if (!env.WATSONX_PROJECT_ID) throw createError(503, 'WATSONX_PROJECT_ID não configurado no backend');
  const data = await watsonxPost('/ml/v1/text/embeddings', {
    model_id: env.WATSONX_EMBEDDING_MODEL, project_id: env.WATSONX_PROJECT_ID, inputs,
    parameters: { truncate_input_tokens: 512 },
  }, '2024-05-31');
  const embeddings = data.results?.map((r) => r.embedding);
  if (embeddings?.length !== inputs.length || embeddings.some((v) =>
    !Array.isArray(v) || v.length !== 768 || !v.every(Number.isFinite) || !v.some((n) => n !== 0))) {
    throw createError(502, 'Embeddings IBM inválidos: são necessários vetores de 768 dimensões');
  }
  return embeddings;
}
