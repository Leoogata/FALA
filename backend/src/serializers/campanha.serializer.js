/**
 * Serializers: transformam as entidades do Prisma (camelCase)
 * no shape esperado pelo frontend (snake_case + campos calculados).
 *
 * Frontend types (frontend/src/api/types.ts):
 *
 *   AgenteResumo  → id, nome, ativa, criada_em, atualizada_em, docs: DocsCount
 *   AgenteDetalhe → ...AgenteResumo, instrucoes, documentos: Material[]
 *   Material      → id, campanha_id, nome_original, mime_type, status_indexacao,
 *                   erro_indexacao, tamanho_bytes, criado_em, atualizado_em
 *   DocsCount     → { pronto, processando, erro }
 */

/**
 * Serializa um documento do Prisma para o shape `Material` do frontend.
 * @param {object} doc
 */
export function serializeDocumento(doc) {
  return {
    id: doc.id,
    campanha_id: doc.campanhaId,
    nome_original: doc.nomeOriginal,
    mime_type: doc.mimeType,
    status_indexacao: doc.statusIndexacao?.toLowerCase() ?? 'processando',
    erro_indexacao: doc.erroIndexacao ?? null,
    tamanho_bytes: doc.tamanhoBytes ?? null,
    criado_em: doc.criadoEm,
    atualizado_em: doc.atualizadoEm ?? doc.criadoEm,
  };
}

/**
 * Calcula `docs: DocsCount` a partir de uma lista de documentos serializados.
 * @param {object[]} documentos  — já serializados (com status_indexacao em lowercase)
 */
function calcDocs(documentos) {
  return documentos.reduce(
    (acc, d) => {
      if (d.status_indexacao === 'pronto') acc.pronto++;
      else if (d.status_indexacao === 'processando') acc.processando++;
      else acc.erro++;
      return acc;
    },
    { pronto: 0, processando: 0, erro: 0 },
  );
}

/**
 * Serializa uma campanha com (ou sem) documentos para `AgenteDetalhe`.
 * Quando `documentos` não está presente (e.g. resposta do PATCH),
 * omite o campo — o frontend não o usa nesse caso.
 * @param {object} campanha
 */
export function serializeCampanhaDetalhe(campanha) {
  const documentos = campanha.documentos
    ? campanha.documentos.map(serializeDocumento)
    : undefined;

  return {
    id: campanha.id,
    nome: campanha.nome,
    ativa: campanha.ativa,
    instrucoes: campanha.descricao ?? null,
    criada_em: campanha.criadaEm,
    atualizada_em: campanha.atualizadaEm ?? campanha.criadaEm,
    docs: documentos ? calcDocs(documentos) : { pronto: 0, processando: 0, erro: 0 },
    ...(documentos !== undefined && { documentos }),
  };
}

/**
 * Serializa uma campanha da listagem para `AgenteResumo`.
 * Espera `documentos: [{ statusIndexacao }]` do Prisma.
 * @param {object} campanha
 */
export function serializeCampanhaResumo(campanha) {
  const docs = (campanha.documentos ?? []).reduce(
    (acc, d) => {
      const s = d.statusIndexacao?.toLowerCase() ?? 'processando';
      if (s === 'pronto') acc.pronto++;
      else if (s === 'processando') acc.processando++;
      else acc.erro++;
      return acc;
    },
    { pronto: 0, processando: 0, erro: 0 },
  );

  return {
    id: campanha.id,
    nome: campanha.nome,
    ativa: campanha.ativa,
    criada_em: campanha.criadaEm,
    atualizada_em: campanha.atualizadaEm ?? campanha.criadaEm,
    docs,
  };
}
