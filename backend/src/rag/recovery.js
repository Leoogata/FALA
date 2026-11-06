// Documento.PROCESSANDO é o registro durável do trabalho pendente.
// Após um restart, a indexação é refeita de maneira idempotente.
import prisma from '../config/prisma.js';
import { queue } from './queue.js';

export async function recuperarOrfaos() {
  const pendentes = await prisma.documento.findMany({ where: { statusIndexacao: 'PROCESSANDO' },
    select: { id: true, campanhaId: true, caminhoArquivo: true } });
  for (const d of pendentes) {
    queue.enqueue({ documentoId: d.id, campanhaId: d.campanhaId, caminhoArquivo: d.caminhoArquivo });
  }
  if (pendentes.length) console.info(`[startup] ${pendentes.length} documento(s) reenfileirados para indexação.`);
}
