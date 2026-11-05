// src/services/twiml.js — Construtores de TwiML
'use strict';

const twilio = require('twilio');
const config = require('../config');
const { urlMensagemFixa } = require('./tts');

const VoiceResponse = twilio.twiml.VoiceResponse;
const VOICE = 'Polly.Camila';   // fallback quando ElevenLabs não está disponível
const LANGUAGE = 'pt-BR';

/**
 * Monta a URL de ação do Gather com o turno_token como query param.
 * @param {string} turnoToken
 * @returns {string}
 */
function actionUrl(turnoToken) {
  return `/voice/turn?turno_token=${encodeURIComponent(turnoToken)}`;
}

/**
 * TwiML de boas-vindas: Say + Gather para capturar a pergunta inicial.
 * @param {string} turnoToken — token emitido para esta captura.
 * Adiciona fala a um nó TwiML (Gather ou Response).
 * Se audioUrl estiver definida, usa <Play>; caso contrário, <Say> com Polly.
 *
 * @param {object} node    — instância de VoiceResponse ou Gather
 * @param {string} texto   — texto para <Say> (sempre preenchido, usado no fallback)
 * @param {string|null} audioUrl — URL pública do MP3 (ElevenLabs) ou null
 */
function addSpeech(node, texto, audioUrl) {
  if (audioUrl) {
    node.play(audioUrl);
  } else {
    node.say({ language: LANGUAGE, voice: VOICE }, texto);
  }
}

/**
 * TwiML de boas-vindas: fala + Gather para capturar a pergunta inicial.
 */
function buildWelcomeTwiml(turnoToken) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
  });
  addSpeech(gather, config.fallbackMessages.boasVindas, urlMensagemFixa('boasVindas'));
  // Redirect acionado se Gather expirar sem fala
  response.redirect({ method: 'POST' }, actionUrl(turnoToken));
  return response.toString();
}

/**
 * TwiML de fallback STT com nova tentativa.
 * @param {string} turnoToken — token para esta nova captura.
 */
function buildSttRetryTwiml(turnoToken) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.sttRetry);
  response.redirect({ method: 'POST' }, actionUrl(turnoToken));
  addSpeech(gather, config.fallbackMessages.sttRetry, urlMensagemFixa('sttRetry'));
  response.redirect({ method: 'POST' }, '/voice/turn');
  return response.toString();
}

/**
 * TwiML de encerramento após tentativas STT esgotadas.
 */
function buildSttMaxRetriesTwiml() {
  const response = new VoiceResponse();
  addSpeech(response, config.fallbackMessages.sttEncerrar, urlMensagemFixa('sttEncerrar'));
  response.hangup();
  return response.toString();
}

/**
 * TwiML de fallback de roteamento: pede reformulação + novo Gather.
 * @param {string} turnoToken — token para próxima captura.
 */
function buildNoRouteTwiml(turnoToken) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.semRota);
  response.redirect({ method: 'POST' }, actionUrl(turnoToken));
  addSpeech(gather, config.fallbackMessages.semRota, urlMensagemFixa('semRota'));
  response.redirect({ method: 'POST' }, '/voice/turn');
  return response.toString();
}

/**
 * TwiML de resposta com próximo turno.
 * @param {string} resposta — Texto da resposta do subagente.
 * @param {string} turnoToken — token para próxima captura.
 */
function buildAnswerTwiml(resposta, turnoToken) {
 *
 * @param {string} resposta  — Texto da resposta do subagente (para fallback <Say>)
 * @param {string|null} audioUrl — URL pública do MP3 gerado pelo ElevenLabs, ou null
 */
function buildAnswerTwiml(resposta, audioUrl = null) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech dtmf',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
    numDigits: '1',
  });
  // Resposta educacional — áudio dinâmico gerado por turno
  addSpeech(gather, resposta, audioUrl);
  // Prompt de continuação — áudio pré-gerado fixo
  addSpeech(gather, config.fallbackMessages.proximoTurno, urlMensagemFixa('proximoTurno'));
  addSpeech(response, config.fallbackMessages.encerramento, urlMensagemFixa('encerramento'));
  response.hangup();
  return response.toString();
}

/**
 * TwiML de fallback de resposta (sem_resposta: true).
 * @param {string} turnoToken — token para próxima captura.
 */
function buildNoAnswerTwiml(turnoToken) {
 *
 * @param {string|null} audioUrl — URL pública do MP3 com a mensagem de fallback, ou null
 */
function buildNoAnswerTwiml(audioUrl = null) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech dtmf',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
    numDigits: '1',
  });
  addSpeech(gather, config.fallbackMessages.semResposta, audioUrl);
  addSpeech(gather, config.fallbackMessages.proximoTurno, urlMensagemFixa('proximoTurno'));
  addSpeech(response, config.fallbackMessages.encerramento, urlMensagemFixa('encerramento'));
  response.hangup();
  return response.toString();
}

/**
 * TwiML de pedido de esclarecimento.
 * @param {string} perguntaEsclarecimento — Texto da pergunta de esclarecimento.
 * @param {string} turnoToken — token para próxima captura.
 */
function buildEsclarecimentoTwiml(perguntaEsclarecimento, turnoToken) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech dtmf',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: actionUrl(turnoToken),
    method: 'POST',
    numDigits: '1',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, perguntaEsclarecimento);
  response.redirect({ method: 'POST' }, actionUrl(turnoToken));
  return response.toString();
}

/**
 * TwiML de indisponibilidade temporária (banco fora, contexto inacessível).
 */
function buildIndisponibilidadeTwiml() {
  const response = new VoiceResponse();
  response.say(
    { language: LANGUAGE, voice: VOICE },
    config.fallbackMessages.indisponibilidade
  );
  response.hangup();
  return response.toString();
}

/**
 * TwiML de encerramento limpo (aluno pressionou tecla).
 */
function buildHangupTwiml() {
  const response = new VoiceResponse();
  addSpeech(response, config.fallbackMessages.encerramento, urlMensagemFixa('encerramento'));
  response.hangup();
  return response.toString();
}

module.exports = {
  buildWelcomeTwiml,
  buildSttRetryTwiml,
  buildSttMaxRetriesTwiml,
  buildNoRouteTwiml,
  buildAnswerTwiml,
  buildNoAnswerTwiml,
  buildEsclarecimentoTwiml,
  buildIndisponibilidadeTwiml,
  buildHangupTwiml,
};
