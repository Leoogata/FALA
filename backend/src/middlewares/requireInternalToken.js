import { env } from '../config/env.js';
import { createError } from './errorHandler.js';

/**
 * Middleware de autenticação por Bearer token fixo.
 * Usado no endpoint /rag/search para restringir acesso a chamadas internas
 * (telephony-handler → backend).
 *
 * Verifica o header: Authorization: Bearer <RAG_INTERNAL_TOKEN>
 * Rejeita com 401 se ausente ou incorreto.
 */
export function requireInternalToken(req, _res, next) {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== env.RAG_INTERNAL_TOKEN) {
    return next(createError(401, 'Token inválido ou ausente'));
  }

  next();
}
