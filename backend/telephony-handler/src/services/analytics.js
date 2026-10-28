// src/services/analytics.js — Disparo assíncrono de POST /interacoes (US-09)
'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Registra uma interação no serviço de analytics.
 * Operação fire-and-forget: falhas são logadas mas não propagadas,
 * para não impactar a latência da resposta ao Twilio.
 *
 * @param {{ campanha_id, pergunta, resposta, score_confianca_stt, score_confianca_agente, sem_resposta, call_sid }} payload
 */
function registrarInteracao(payload) {
  axios
    .post(`${config.analyticsServiceUrl}/interacoes`, payload, { timeout: 5000 })
    .catch((err) => {
      console.error('[analytics] Falha ao registrar interação:', err.message, { call_sid: payload.call_sid });
    });
}

module.exports = { registrarInteracao };
