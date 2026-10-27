/**
 * Recuperação de documentos órfãos em status PROCESSANDO.
 *
 * Problema: se o servidor reiniciar com jobs na fila em memória,
 * os documentos ficam presos em PROCESSANDO para sempre — a fila
 * não persiste entre restarts.
 *
 * Solução: ao iniciar, marcar como ERRO qualquer documento que esteja
 * em PROCESSANDO há mais de ORPHAN_TIMEOUT_MINUTES minutos.
 * Esses documentos podem ser re-enviados manualmente pelo operador.
 */

import prisma from '../config/prisma.js';

const ORPHAN_TIMEOUT_MINUTES = parseInt(process.env.ORPHAN_TIMEOUT_MINUTES ?? '15', 10);

export async function recuperarOrfaos() {
  const corte = new Date(Date.now() - ORPHAN_TIMEOUT_MINUTES * 60 * 1000);

  const { count } = await prisma.documento.updateMany({
    where: {
      statusIndexacao: 'PROCESSANDO',
      criadoEm: { lt: corte },
    },
    data: {
      statusIndexacao: 'ERRO',
      erroIndexacao: `Pipeline interrompido por restart do servidor (documento em PROCESSANDO há mais de ${ORPHAN_TIMEOUT_MINUTES} minutos).`,
    },
  });

  if (count > 0) {
    console.warn(`[startup] ${count} documento(s) órfão(s) marcados como ERRO.`);
  }
}
