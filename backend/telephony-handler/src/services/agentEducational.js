// A geração e o RAG vivem no backend, compartilhados pelo painel e pela voz.
'use strict';
const axios = require('axios');
const config = require('../config');

async function answerQuestion({ conversaId, turnoToken }) {
  const response = await axios.post(`${config.backendApiUrl}/internal/respostas`, {
    conversa_id: conversaId, turno_token: turnoToken,
  }, {
    headers: { Authorization: `Bearer ${config.internalApiKey}` },
    timeout: config.agentTimeoutMs,
  });
  return response.data;
}
module.exports = { answerQuestion };
