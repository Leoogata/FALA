// src/middlewares/internalAuth.js — Autenticação de serviço para endpoints internos
import { env } from '../config/env.js';
import { createError } from './errorHandler.js';

/**
 * Middleware que valida o header Authorization: Bearer <INTERNAL_API_KEY>
 * para endpoints internos entre serviços. O frontend não deve ter acesso a esses endpoints.
 */
export function internalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!env.INTERNAL_API_KEY) {
    // Em desenvolvimento sem chave configurada, bloquear mesmo assim
    return next(createError(503, 'Autenticação interna não configurada'));
  }

  if (!token || token !== env.INTERNAL_API_KEY) {
    return next(createError(401, 'Não autorizado'));
  }

  return next();
}
