import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import prisma from '../config/prisma.js';
import { createError } from './errorHandler.js';

export async function schoolAuth(req, _res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const candidate = Buffer.from(token);
    const match = Object.entries(env.SCHOOL_API_TOKENS).find(([, secret]) => {
      const expected = Buffer.from(secret);
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
    if (!match) throw createError(401, 'Informe a chave de acesso do painel da escola');
    const escola = await prisma.escola.findUnique({ where: { codigo: match[0] } });
    if (!escola) throw createError(403, 'Escola não cadastrada');
    req.escola = escola;
    next();
  } catch (err) { next(err); }
}

// Executado antes do Multer: um upload sem permissão não chega ao disco.
export async function schoolAgentAccess(req, _res, next) {
  try {
    if (req.params.id === 'ativas') return next();
    const agente = await prisma.campanha.findFirst({ where: { id: req.params.id, escolaId: req.escola.id } });
    if (!agente) throw createError(404, 'Agente não encontrado nesta escola');
    next();
  } catch (err) { next(err); }
}
