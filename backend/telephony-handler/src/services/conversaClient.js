// src/services/conversaClient.js — Cliente HTTP para os endpoints internos de conversa
// Este serviço usa CommonJS (igual ao resto do telephony-handler).
'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Obtém os headers de autenticação interna.
 */
function authHeaders() {
  return { Authorization: `Bearer ${config.internalApiKey}` };
}

/**
 * Cria ou recupera uma conversa pela chave HMAC.
 *
 * @param {{ chaveChamada: string, versaoChave: string }} params
 * @returns {Promise<{ conversa_id: string, estado: string }>}
 */
async function criarOuRecuperarConversa({ chaveChamada, versaoChave }) {
  const response = await axios.post(
    `${config.backendApiUrl}/internal/conversas`,
    { chave_chamada: chaveChamada, versao_chave: versaoChave },
    { headers: authHeaders(), timeout: config.conversaClientTimeoutMs }
  );
  return response.data;
}

/**
 * Busca o contexto de uma conversa (últimas trocas elegíveis para os agentes).
 *
 * @param {string} conversaId
 * @returns {Promise<Array<{ pergunta: string, resposta: string, materia: string|null, status: string }>>}
 */
async function buscarContexto(conversaId) {
  const response = await axios.get(
    `${config.backendApiUrl}/internal/conversas/${conversaId}/contexto`,
    { headers: authHeaders(), timeout: config.conversaClientTimeoutMs }
  );
  return response.data.historico;
}

/**
 * Reserva um turno na conversa (idempotente por turno_token).
 *
 * @param {{ conversaId: string, turnoToken: string, pergunta: string|null, textoSuprimido: boolean }} params
 * @returns {Promise<{ interacao_id: string, ordem: number, status: string, ja_existia: boolean }>}
 */
async function reservarTurno({ conversaId, turnoToken, pergunta, textoSuprimido }) {
  const response = await axios.post(
    `${config.backendApiUrl}/internal/conversas/${conversaId}/turnos`,
    {
      turno_token: turnoToken,
      pergunta: pergunta ?? null,
      texto_suprimido: textoSuprimido ?? false,
    },
    { headers: authHeaders(), timeout: config.conversaClientTimeoutMs }
  );
  // response.data: { interacao_id, ordem, status, mensagem_retorno, concluida_em, ja_existia }
  return response.data;
}

/**
 * Finaliza um turno com o resultado do processamento.
 * Substitui o fire-and-forget do analytics anterior.
 *
 * @param {object} payload
 * @returns {Promise<{ id: string, status: string }>}
 */
async function concluirTurno(payload) {
  const response = await axios.post(
    `${config.backendApiUrl}/interacoes`,
    payload,
    { headers: authHeaders(), timeout: config.conversaClientTimeoutMs }
  );
  return response.data;
}

/**
 * Encerra uma conversa explicitamente (por tecla ou evento de término).
 *
 * @param {string} conversaId
 * @returns {Promise<void>}
 */
async function encerrarConversa(conversaId) {
  await axios.patch(
    `${config.backendApiUrl}/internal/conversas/${conversaId}`,
    { estado: 'ENCERRADA' },
    { headers: authHeaders(), timeout: config.conversaClientTimeoutMs }
  );
}

module.exports = {
  criarOuRecuperarConversa,
  buscarContexto,
  reservarTurno,
  concluirTurno,
  encerrarConversa,
};
