// src/handlers/incomingHandler.js — Handler POST /voice/incoming
'use strict';

const twiml = require('../services/twiml');

/**
 * POST /voice/incoming
 * Chamado pelo Twilio quando o número recebe uma ligação.
 * 1. Valida presença do CallSid.
 * 2. Cria/recupera a conversa no banco via HMAC.
 * 3. Gera o primeiro turno_token para a captura inicial.
 * 4. Responde com TwiML de boas-vindas + Gather com o token na URL de ação.
 */
async function incomingHandler(req, res) {
  const callSid = req.body.CallSid || '';

  // Rejeitar requisições sem CallSid válido
  if (!callSid) {
    console.warn('[incoming] Requisição sem CallSid — rejeitando');
    return res.status(400).type('text/xml').send('<Response><Hangup/></Response>');
  }

  // Primeiro passo: pede o código da escola (DTMF). O aluno pode digitar ou
  // aguardar para seguir no conteúdo geral. A resposta vai para /voice/escola,
  // onde a conversa é criada e o primeiro turno_token é emitido.
  return res.type('text/xml').send(twiml.buildPedirCodigoTwiml());
}

module.exports = incomingHandler;
