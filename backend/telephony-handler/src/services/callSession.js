// src/services/callSession.js — Estado local de sessão por chamada
// Separa tentativas STT do estado de conversa persistida.
// Em produção com múltiplas instâncias, substituir por Redis ou similar.
'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * Map<callSid, { retries: number, conversaId: string|null, turnoToken: string|null }>
 */
const sessions = new Map();

// ── Tentativas STT ────────────────────────────────────────────────────────────

function getRetries(callSid) {
  return sessions.get(callSid)?.retries || 0;
}

function incrementRetries(callSid) {
  const session = sessions.get(callSid) || { retries: 0, conversaId: null, turnoToken: null };
  session.retries += 1;
  sessions.set(callSid, session);
  return session.retries;
}

/**
 * Zera somente as tentativas STT — preserva conversaId e turnoToken.
 * Usado após fala válida reconhecida.
 */
function resetRetries(callSid) {
  const session = sessions.get(callSid);
  if (session) {
    session.retries = 0;
    sessions.set(callSid, session);
  }
}

// ── Conversa e tokens ─────────────────────────────────────────────────────────

function getConversaId(callSid) {
  return sessions.get(callSid)?.conversaId ?? null;
}

function setConversaId(callSid, conversaId) {
  const session = sessions.get(callSid) || { retries: 0, conversaId: null, turnoToken: null };
  session.conversaId = conversaId;
  sessions.set(callSid, session);
}

function getTurnoToken(callSid) {
  return sessions.get(callSid)?.turnoToken ?? null;
}

function setTurnoToken(callSid, turnoToken) {
  const session = sessions.get(callSid) || { retries: 0, conversaId: null, turnoToken: null };
  session.turnoToken = turnoToken;
  sessions.set(callSid, session);
}

// ── HMAC de identificação ─────────────────────────────────────────────────────

/**
 * Calcula HMAC-SHA256(segredo, callSid) para associar a ligação à conversa
 * sem persistir o CallSid original no banco.
 *
 * @param {string} callSid
 * @returns {{ chave: string, versao: string }}
 */
function calcularChaveChamada(callSid) {
  const segredo = config.hmacSecret;
  const versao = config.hmacSecretVersion;
  const chave = crypto.createHmac('sha256', segredo).update(callSid).digest('hex');
  return { chave, versao };
}

// ── Limpeza ───────────────────────────────────────────────────────────────────

/**
 * Remove completamente a sessão local após encerramento da chamada.
 * NÃO remove o histórico persistido no banco.
 */
function clearSession(callSid) {
  sessions.delete(callSid);
}

module.exports = {
  getRetries,
  incrementRetries,
  resetRetries,
  getConversaId,
  setConversaId,
  getTurnoToken,
  setTurnoToken,
  calcularChaveChamada,
  clearSession,
};
