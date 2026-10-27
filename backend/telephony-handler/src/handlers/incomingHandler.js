// src/handlers/incomingHandler.js — Handler POST /voice/incoming
'use strict';

const twiml = require('../services/twiml');

/**
 * POST /voice/incoming
 * Chamado pelo Twilio quando o número recebe uma ligação.
 * Responde com TwiML de boas-vindas + Gather para capturar a pergunta.
 */
async function incomingHandler(req, res) {
  const callSid = req.body.CallSid || 'unknown';
  console.info(`[incoming] CallSid=${callSid} From=${req.body.From}`);

  res.type('text/xml').send(twiml.buildWelcomeTwiml());
}

module.exports = incomingHandler;
