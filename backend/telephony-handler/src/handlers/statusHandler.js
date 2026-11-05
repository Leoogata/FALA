// src/handlers/statusHandler.js — Handler POST /voice/status (callback de término)
'use strict';

const session = require('../services/callSession');
const conversaClient = require('../services/conversaClient');

/**
 * POST /voice/status
 * Chamado pelo Twilio quando a chamada termina (StatusCallback).
 * Encerra a conversa no banco e limpa a sessão local.
 *
 * Quando a conversa não está em memória (ex: reinício do processo), recupera via
 * criarOuRecuperarConversa para garantir o encerramento mesmo sem sessão local.
 */
async function statusHandler(req, res) {
  const callSid = req.body.CallSid || '';
  const callStatus = req.body.CallStatus || '';

  if (!callSid) {
    return res.status(200).end();
  }

  const statusesFinais = ['completed', 'busy', 'failed', 'no-answer', 'canceled'];
  if (statusesFinais.includes(callStatus)) {
    let conversaId = session.getConversaId(callSid);

    if (!conversaId) {
      // Sessão perdida (ex: reinício do processo) — recuperar conversa pelo HMAC
      try {
        const { chave, versao } = session.calcularChaveChamada(callSid);
        const conversa = await conversaClient.criarOuRecuperarConversa({
          chaveChamada: chave,
          versaoChave: versao,
        });
        // Só encerrar se a conversa ainda estava ativa
        if (conversa.estado === 'ATIVA') {
          conversaId = conversa.conversa_id;
        }
      } catch (err) {
        console.error('[status] Falha ao recuperar conversa para encerramento:', err.message);
      }
    }

    if (conversaId) {
      try {
        await conversaClient.encerrarConversa(conversaId);
      } catch (err) {
        console.error('[status] Falha ao encerrar conversa:', err.message);
      }
    }
    session.clearSession(callSid);
  }

  // Twilio não espera resposta específica no StatusCallback
  return res.status(200).end();
}

module.exports = statusHandler;
