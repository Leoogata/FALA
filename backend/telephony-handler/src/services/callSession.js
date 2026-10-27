// src/services/callSession.js — Controle de tentativas por chamada (em memória)
'use strict';

// Map<callSid, { retries: number }>
// Em produção com múltiplas instâncias, substituir por Redis ou similar.
const sessions = new Map();

/**
 * Retorna o número de tentativas STT da chamada.
 * @param {string} callSid
 * @returns {number}
 */
function getRetries(callSid) {
  return sessions.get(callSid)?.retries || 0;
}

/**
 * Incrementa o contador de tentativas e retorna o novo valor.
 * @param {string} callSid
 * @returns {number}
 */
function incrementRetries(callSid) {
  const current = getRetries(callSid);
  const next = current + 1;
  sessions.set(callSid, { retries: next });
  return next;
}

/**
 * Remove a sessão da chamada da memória.
 * @param {string} callSid
 */
function clearSession(callSid) {
  sessions.delete(callSid);
}

module.exports = { getRetries, incrementRetries, clearSession };
