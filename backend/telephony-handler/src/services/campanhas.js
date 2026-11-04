// src/services/campanhas.js — Busca campanhas ativas no backend/api
'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Busca campanhas ativas em GET /campanhas/ativas.
 * Retorna o formato esperado pelo orquestrador: { campanhaId, nome, descricao }.
 * Campanhas sem descricao são excluídas pelo backend (o orquestrador precisa da descricao).
 *
 * @returns {Promise<Array<{ campanhaId: string, nome: string, descricao: string }>>}
 */
async function getCampanhasAtivas() {
  const response = await axios.get(`${config.backendApiUrl}/campanhas/ativas`, {
    timeout: 5000,
  });
  return response.data;
}

module.exports = { getCampanhasAtivas };
