// src/handlers/turnHandler.js — Handler POST /voice/turn
'use strict';

const config = require('../config');
const twiml = require('../services/twiml');
const session = require('../services/callSession');
const orchestrator = require('../services/orchestrator');
const agentEducational = require('../services/agentEducational');
const campanhas = require('../services/campanhas');
const analytics = require('../services/analytics');

/**
 * POST /voice/turn
 * Processa o resultado do <Gather> e orquestra:
 *   1. Validação de STT
 *   2. Roteamento pelo orquestrador
 *   3. Resposta pelo subagente educacional
 *   4. Montagem do TwiML de resposta
 *   5. Registro da interação no analytics (fire-and-forget)
 */
async function turnHandler(req, res) {
  const callSid = req.body.CallSid || 'unknown';
  const speechResult = req.body.SpeechResult || '';
  const rawConfidence = req.body.Confidence;
  const digits = req.body.Digits || '';

  const confidenceStt = rawConfidence !== undefined ? parseFloat(rawConfidence) : 0;

  console.info(`[turn] CallSid=${callSid} SpeechResult="${speechResult}" Confidence=${confidenceStt}`);

  // Aluno pressionou tecla → encerrar chamada
  if (digits && !speechResult) {
    session.clearSession(callSid);
    return res.type('text/xml').send(twiml.buildHangupTwiml());
  }

  // --- Validação STT ---
  const hasValidSpeech = speechResult.trim().length > 0 && confidenceStt >= config.sttConfidenceThreshold;

  if (!hasValidSpeech) {
    const retries = session.incrementRetries(callSid);
    if (retries >= config.voiceMaxRetries) {
      session.clearSession(callSid);
      return res.type('text/xml').send(twiml.buildSttMaxRetriesTwiml());
    }
    return res.type('text/xml').send(twiml.buildSttRetryTwiml());
  }

  // Fala válida — resetar contador de tentativas
  session.clearSession(callSid);

  // --- Roteamento ---
  let routeResult;
  let campanhasAtivas = [];

  try {
    campanhasAtivas = await campanhas.getCampanhasAtivas();
    routeResult = await orchestrator.routeQuestion({ pergunta: speechResult, campanhasAtivas });
  } catch (err) {
    console.error(`[turn] Erro no roteamento: ${err.message}`, { callSid });
    return res.type('text/xml').send(twiml.buildNoRouteTwiml());
  }

  const { campanhaId, confianca: confidenceOrchestrator, sem_rota } = routeResult;

  if (sem_rota || confidenceOrchestrator < config.orchestratorConfidenceThreshold) {
    console.info(`[turn] sem_rota=true confianca=${confidenceOrchestrator}`, { callSid });
    return res.type('text/xml').send(twiml.buildNoRouteTwiml());
  }

  // --- Subagente educacional ---
  let agentResult;
  try {
    agentResult = await agentEducational.answerQuestion({ campanhaId, pergunta: speechResult });
  } catch (err) {
    console.error(`[turn] Erro no subagente: ${err.message}`, { callSid, campanhaId });
    agentResult = { resposta: '', confianca: 0, sem_resposta: true };
  }

  const { resposta, confianca: confidenceAgent, sem_resposta } = agentResult;

  // --- Registro no analytics (fire-and-forget) ---
  analytics.registrarInteracao({
    campanha_id: campanhaId,
    pergunta: speechResult,
    resposta: sem_resposta ? '' : resposta,
    score_confianca_stt: confidenceStt,
    score_confianca_agente: confidenceAgent,
    sem_resposta,
    call_sid: callSid,
  });

  // --- TwiML de resposta ---
  if (sem_resposta) {
    return res.type('text/xml').send(twiml.buildNoAnswerTwiml());
  }

  return res.type('text/xml').send(twiml.buildAnswerTwiml(resposta));
}

module.exports = turnHandler;
