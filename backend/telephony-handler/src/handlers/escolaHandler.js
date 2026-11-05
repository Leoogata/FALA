// src/handlers/escolaHandler.js — Handler POST /voice/escola
'use strict';

const { randomUUID } = require('crypto');
const twiml = require('../services/twiml');
const session = require('../services/callSession');
const campanhas = require('../services/campanhas');
const conversaClient = require('../services/conversaClient');
const { urlMensagemFixa, textoParaAudioUrl } = require('../services/tts');
const config = require('../config');

/**
 * POST /voice/escola
 * Segundo passo da ligação, após a captura do código da escola (DTMF).
 *   - Com código válido  → guarda a escola na sessão e saúda com o nome dela.
 *   - Com código inválido → avisa e segue no fluxo geral.
 *   - Sem código          → segue no fluxo geral direto.
 *
 * Em todos os casos, aqui é onde a conversa é criada (HMAC) e o primeiro
 * turno_token é emitido — porque é este o ponto onde o Gather de voz abre.
 */
async function escolaHandler(req, res) {
  const callSid = req.body.CallSid || '';
  const digits = (req.body.Digits || '').trim();

  if (!callSid) {
    return res.status(400).type('text/xml').send('<Response><Hangup/></Response>');
  }

  // 1. Resolver escola (se houve código) e registrar na sessão + preparar saudação.
  let prefixoTexto = null;
  let prefixoAudioUrl = null;

  if (digits) {
    try {
      const escola = await campanhas.resolverEscola(digits);
      if (escola) {
        console.info(`[escola] CallSid=${callSid} código ${digits} → ${escola.nome}`);
        session.setEscola(callSid, escola.codigo);
        prefixoTexto = `Olá, aluno da ${escola.nome}! Agora pode fazer sua pergunta.`;
        prefixoAudioUrl = await textoParaAudioUrl(prefixoTexto);
      } else {
        console.info(`[escola] CallSid=${callSid} código ${digits} inválido — fluxo geral`);
        session.setEscola(callSid, null);
        prefixoTexto = config.fallbackMessages.codigoInvalido;
        prefixoAudioUrl = urlMensagemFixa('codigoInvalido');
      }
    } catch (err) {
      console.error(`[escola] Erro ao resolver código ${digits}: ${err.message}`, { callSid });
      session.setEscola(callSid, null);
    }
  } else {
    console.info(`[escola] CallSid=${callSid} sem código — fluxo geral`);
    session.setEscola(callSid, null);
  }

  // 2. Criar/recuperar a conversa (identificação pseudônima via HMAC do CallSid).
  try {
    const { chave, versao } = session.calcularChaveChamada(callSid);
    const conversa = await conversaClient.criarOuRecuperarConversa({
      chaveChamada: chave,
      versaoChave: versao,
    });
    if (conversa.estado !== 'ATIVA') {
      console.warn('[escola] Conversa não está ativa:', { estado: conversa.estado });
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    session.setConversaId(callSid, conversa.conversa_id);
  } catch (err) {
    console.error('[escola] Falha ao criar conversa:', err.message);
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  // 3. Emitir o primeiro turno_token e abrir o Gather de voz (com a saudação).
  const turnoToken = randomUUID();
  session.setTurnoToken(callSid, turnoToken);

  return res.type('text/xml').send(
    twiml.buildWelcomeTwiml(turnoToken, { prefixoTexto, prefixoAudioUrl }),
  );
}

module.exports = escolaHandler;
