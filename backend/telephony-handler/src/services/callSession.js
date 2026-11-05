// src/services/callSession.js — Estado local de sessão por chamada
// Separa tentativas STT do estado de conversa persistida.
// Em produção com múltiplas instâncias, substituir por Redis ou similar.
'use strict';

const crypto = require('crypto');
const config = require('../config');

/**
 * Map<callSid, {
 *   retries: number,
 *   conversaId: string|null,
 *   turnoToken: string|null,
 *   codigoEscola: string|null   // escola escolhida na URA (null = conteúdo geral)
 * }>
 */
const sessions = new Map();

function get(callSid) {
  return sessions.get(callSid) || {};
}

function ensure(callSid) {
  let s = sessions.get(callSid);
  if (!s) {
    s = { retries: 0, conversaId: null, turnoToken: null, codigoEscola: null };
    sessions.set(callSid, s);
  }
  return s;
}

// ── Tentativas STT ────────────────────────────────────────────────────────────

function getRetries(callSid) {
  return get(callSid).retries || 0;
}

function incrementRetries(callSid) {
  const s = ensure(callSid);
  s.retries += 1;
  return s.retries;
}

/**
 * Zera somente as tentativas STT — preserva conversaId, turnoToken e escola.
 * Usado após fala válida reconhecida.
 */
function resetRetries(callSid) {
  const s = sessions.get(callSid);
  if (s) s.retries = 0;
}

// ── Conversa e tokens ─────────────────────────────────────────────────────────

function getConversaId(callSid) {
  return sessions.get(callSid)?.conversaId ?? null;
}

function setConversaId(callSid, conversaId) {
  ensure(callSid).conversaId = conversaId;
}

function getTurnoToken(callSid) {
  return sessions.get(callSid)?.turnoToken ?? null;
}

function setTurnoToken(callSid, turnoToken) {
  ensure(callSid).turnoToken = turnoToken;
}

// ── Escola (URA por código) ───────────────────────────────────────────────────

/**
 * Guarda o código da escola escolhida na chamada (ou null para o fluxo geral).
 */
function setEscola(callSid, codigoEscola) {
  ensure(callSid).codigoEscola = codigoEscola || null;
}

/**
 * Retorna o código da escola da chamada, ou null se não houver (fluxo geral).
 */
function getEscola(callSid) {
  return sessions.get(callSid)?.codigoEscola ?? null;
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
  setEscola,
  getEscola,
  calcularChaveChamada,
  clearSession,
};
