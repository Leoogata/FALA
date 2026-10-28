// src/services/twiml.js — Construtores de TwiML
'use strict';

const twilio = require('twilio');
const config = require('../config');

const VoiceResponse = twilio.twiml.VoiceResponse;
const VOICE = 'Polly.Camila';
const LANGUAGE = 'pt-BR';

/**
 * TwiML de boas-vindas: Say + Gather para capturar a pergunta inicial.
 */
function buildWelcomeTwiml() {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: '/voice/turn',
    method: 'POST',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.boasVindas);
  // Redirect acionado se Gather expirar sem fala
  response.redirect({ method: 'POST' }, '/voice/turn');
  return response.toString();
}

/**
 * TwiML de fallback STT com nova tentativa.
 */
function buildSttRetryTwiml() {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: '/voice/turn',
    method: 'POST',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.sttRetry);
  response.redirect({ method: 'POST' }, '/voice/turn');
  return response.toString();
}

/**
 * TwiML de encerramento após tentativas STT esgotadas.
 */
function buildSttMaxRetriesTwiml() {
  const response = new VoiceResponse();
  response.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.sttEncerrar);
  response.hangup();
  return response.toString();
}

/**
 * TwiML de fallback de roteamento: pede reformulação + novo Gather.
 */
function buildNoRouteTwiml() {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: '/voice/turn',
    method: 'POST',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.semRota);
  response.redirect({ method: 'POST' }, '/voice/turn');
  return response.toString();
}

/**
 * TwiML de resposta com próximo turno.
 * @param {string} resposta - Texto da resposta do subagente.
 */
function buildAnswerTwiml(resposta) {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech dtmf',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: '/voice/turn',
    method: 'POST',
    numDigits: '1',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, resposta);
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.proximoTurno);
  response.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.encerramento);
  response.hangup();
  return response.toString();
}

/**
 * TwiML de fallback de resposta (sem_resposta: true).
 */
function buildNoAnswerTwiml() {
  const response = new VoiceResponse();
  const gather = response.gather({
    input: 'speech dtmf',
    language: LANGUAGE,
    speechTimeout: 'auto',
    action: '/voice/turn',
    method: 'POST',
    numDigits: '1',
  });
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.semResposta);
  gather.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.proximoTurno);
  response.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.encerramento);
  response.hangup();
  return response.toString();
}

/**
 * TwiML de encerramento limpo (aluno pressionou tecla).
 */
function buildHangupTwiml() {
  const response = new VoiceResponse();
  response.say({ language: LANGUAGE, voice: VOICE }, config.fallbackMessages.encerramento);
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
  buildHangupTwiml,
};
