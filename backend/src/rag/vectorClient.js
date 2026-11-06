import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { embedTexts } from '../services/watsonx.service.js';
import { createError } from '../middlewares/errorHandler.js';

// A extensão pode estar em public (Postgres) ou extensions (Supabase).
async function vectorNamespace() {
  const [row] = await prisma.$queryRaw`
    SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector'`;
  if (!row) throw createError(503, 'Extensão pgvector não instalada');
  return Prisma.raw(`"${row.nspname.replaceAll('"', '""')}"`);
}

export const vectorClient = {
  async indexChunks(agenteId, chunks) {
    const agente = await prisma.campanha.findUnique({ where: { id: agenteId } });
    if (!agente?.escolaId || !agente.usaRag) throw createError(409, 'RAG requer um agente escolar');
    const namespace = await vectorNamespace();
    const vectors = [];
    for (let i = 0; i < chunks.length; i += 16) {
      vectors.push(...await embedTexts(chunks.slice(i, i + 16).map((c) => c.texto)));
    }
    await prisma.$transaction(async (tx) => {
      const documentoIds = [...new Set(chunks.map((c) => c.documentoId))];
      for (const documentoId of documentoIds) {
        const rows = await tx.$queryRaw`SELECT id FROM documentos
          WHERE id = ${documentoId} AND campanha_id = ${agenteId} FOR UPDATE`;
        if (!rows.length) throw createError(404, 'Documento removido durante a indexação');
        await tx.$executeRaw`DELETE FROM documento_trechos WHERE documento_id = ${documentoId} AND agente_id = ${agenteId}`;
      }
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        await tx.$executeRaw(Prisma.sql`INSERT INTO documento_trechos
          (documento_id, agente_id, escola_id, ordem, texto, modelo, embedding)
          VALUES (${c.documentoId}, ${agenteId}, ${agente.escolaId}, ${c.ordem}, ${c.texto},
            ${env.WATSONX_EMBEDDING_MODEL}, ${JSON.stringify(vectors[i])}::${namespace}.vector)`);
      }
    }, { timeout: 60000 });
    return { indexados: chunks.length };
  },

  async search(agenteId, query, { topK = 5, escolaId } = {}) {
    if (!escolaId) throw createError(400, 'escolaId obrigatório na busca RAG');
    const namespace = await vectorNamespace();
    const [vector] = await embedTexts([query]);
    const literal = JSON.stringify(vector);
    const resultados = await prisma.$queryRaw(Prisma.sql`
      SELECT t.id::text AS "trechoId", t.documento_id AS "documentoId", t.texto,
        d.nome_original AS "nomeDocumento",
        1 - ${namespace}.cosine_distance(t.embedding, ${literal}::${namespace}.vector) AS score
      FROM documento_trechos t
      JOIN documentos d ON d.id = t.documento_id AND d.campanha_id = t.agente_id
      JOIN campanhas a ON a.id = t.agente_id AND a.escola_id = t.escola_id
      WHERE t.agente_id = ${agenteId} AND t.escola_id = ${escolaId}
        AND d.status_indexacao = 'PRONTO' AND a.usa_rag = true
        AND t.modelo = ${env.WATSONX_EMBEDDING_MODEL}
        AND 1 - ${namespace}.cosine_distance(t.embedding, ${literal}::${namespace}.vector) >= ${env.RAG_MIN_SCORE}
      ORDER BY ${namespace}.cosine_distance(t.embedding, ${literal}::${namespace}.vector)
      LIMIT ${Math.min(20, Math.max(1, topK))}`);
    return { resultados };
  },

  async deleteDocumentChunks(agenteId, documentoId) {
    const removidos = await prisma.$executeRaw`DELETE FROM documento_trechos
      WHERE agente_id = ${agenteId} AND documento_id = ${documentoId}`;
    return { removidos };
  },
};
