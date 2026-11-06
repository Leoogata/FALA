import prisma from '../config/prisma.js';

const documentoSelect = { id: true, campanhaId: true, nomeOriginal: true, mimeType: true,
  statusIndexacao: true, erroIndexacao: true, criadoEm: true, atualizadoEm: true };
const agenteSelect = { id: true, escolaId: true, nome: true, slug: true, descricao: true,
  usaRag: true, ativa: true, criadaEm: true, atualizadaEm: true,
  documentos: { select: documentoSelect, orderBy: { criadoEm: 'desc' } } };

export const campanhasRepository = {
  criar({ nome, slug, descricao, escolaId }) {
    return prisma.campanha.create({ data: { nome, slug, descricao, escolaId, usaRag: true, ativa: false }, select: agenteSelect });
  },
  listar({ ativa, escolaId } = {}) {
    return prisma.campanha.findMany({ where: { escolaId, ...(ativa !== undefined ? { ativa } : {}) },
      select: agenteSelect, orderBy: { criadaEm: 'desc' } });
  },
  async listarAtivasParaOrquestrador({ escolaId } = {}) {
    const agentes = await prisma.campanha.findMany({ where: { ativa: true, escolaId: escolaId ?? null },
      select: agenteSelect });
    return agentes.map((a) => ({ ...a, campanhaId: a.id }));
  },
  buscarEscolaPorCodigo(codigo) {
    return prisma.escola.findUnique({ where: { codigo }, select: { id: true, codigo: true, nome: true } });
  },
  buscarPorId(id) { return prisma.campanha.findUnique({ where: { id }, select: agenteSelect }); },
  // Referências semânticas nunca são usadas na recuperação de materiais.
  buscarAtivaPorReferencia(id, escolaId) {
    return prisma.campanha.findFirst({ where: { id, escolaId, ativa: true, usaRag: true }, select: agenteSelect });
  },
  async atualizar(id, dados) {
    if (dados.ativa !== true) return prisma.campanha.update({ where: { id }, data: dados, select: agenteSelect });
    return prisma.$transaction(async (tx) => {
      const agente = await tx.campanha.findUnique({ where: { id } });
      // Serializa publicações da mesma escola; a constraint parcial é uma segunda proteção.
      await tx.$queryRaw`SELECT id FROM escolas WHERE id = ${agente.escolaId} FOR UPDATE`;
      await tx.campanha.updateMany({ where: { escolaId: agente.escolaId, id: { not: id } }, data: { ativa: false } });
      return tx.campanha.update({ where: { id }, data: dados, select: agenteSelect });
    });
  },
  remover(id) { return prisma.campanha.delete({ where: { id } }); },
  contarDocumentos(campanhaId) { return prisma.documento.count({ where: { campanhaId } }); },
  listarDocumentos(campanhaId) { return prisma.documento.findMany({ where: { campanhaId }, select: { id: true, campanhaId: true } }); },
};
