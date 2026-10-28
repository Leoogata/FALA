// src/services/campanhas.js — Busca campanhas ativas no backend/api
'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Busca a lista de campanhas ativas em GET /campanhas (US-04).
 * @returns {Promise<Array<{ campanhaId: string, nome: string, descricao: string }>>}
 */
async function getCampanhasAtivas() {
  const response = await axios.get(`${config.backendApiUrl}/campanhas`, {
    timeout: 5000,
  });
  return response.data;
}

module.exports = { getCampanhasAtivas };
