// src/handlers/incomingHandler.js — Handler POST /voice/incoming
'use strict';

const { randomUUID } = require('crypto');
const twiml = require('../services/twiml');
const session = require('../services/callSession');
const conversaClient = require('../services/conversaClient');

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

  // Calcular chave de identificação pseudônima
  const { chave, versao } = session.calcularChaveChamada(callSid);

  let conversaId;
  try {
    const conversa = await conversaClient.criarOuRecuperarConversa({
      chaveChamada: chave,
      versaoChave: versao,
    });

    if (conversa.estado !== 'ATIVA') {
      console.warn('[incoming] Conversa não está ativa:', { estado: conversa.estado });
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }

    conversaId = conversa.conversa_id;
    session.setConversaId(callSid, conversaId);
  } catch (err) {
    console.error('[incoming] Falha ao criar conversa:', err.message);
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  // Emitir primeiro token para esta captura
  const turnoToken = randomUUID();
  session.setTurnoToken(callSid, turnoToken);

  return res.type('text/xml').send(twiml.buildWelcomeTwiml(turnoToken));
}

module.exports = incomingHandler;
