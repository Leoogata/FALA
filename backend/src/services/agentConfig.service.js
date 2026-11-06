import prisma from '../config/prisma.js';
import { createError } from '../middlewares/errorHandler.js';

export const agentePadrao = Object.freeze({
  id: null, escolaId: null, nome: 'FALA — Ensino fundamental',
  descricao: '', usaRag: false, modo: 'padrao',
});

export async function selecionarAgente(codigoEscola) {
  if (!codigoEscola) return agentePadrao;
  const escola = await prisma.escola.findUnique({ where: { codigo: codigoEscola } });
  if (!escola) throw createError(404, 'Escola não encontrada');
  const agente = await prisma.campanha.findFirst({ where: { escolaId: escola.id, ativa: true } });
  if (!agente) throw createError(503, 'A escola ainda não publicou um agente');
  if (!agente.usaRag) throw createError(409, 'Agentes escolares devem utilizar os materiais da escola');
  return { ...agente, modo: 'escola' };
}

export async function agenteDaConversa(conversa) {
  if (!conversa.escolaId && !conversa.agenteId) return agentePadrao;
  const agente = await prisma.campanha.findFirst({
    where: { id: conversa.agenteId, escolaId: conversa.escolaId, usaRag: true },
  });
  if (!agente) throw createError(503, 'Agente da conversa indisponível');
  // Uma troca do agente publicado só afeta novas ligações.
  return { ...agente, descricao: conversa.instrucoesAgente ?? '', modo: 'escola' };
}
