import prisma from '../config/prisma.js';

export const campanhasRepository = {
  async criar({ nome, slug, descricao }) {
    return prisma.campanha.create({
      data: { nome, slug, descricao },
      select: { id: true, nome: true, slug: true, descricao: true, ativa: true, criadaEm: true },
    });
  },

  async listar({ ativa } = {}) {
    return prisma.campanha.findMany({
      where: ativa !== undefined ? { ativa } : undefined,
      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        ativa: true,
        criadaEm: true,
        atualizadaEm: true,
        documentos: {
          select: {
            id: true,
            statusIndexacao: true,
          },
        },
      },
      orderBy: { criadaEm: 'desc' },
    });
  },

  /**
   * Lista campanhas ativas no formato do orquestrador: { id, campanhaId, nome, descricao }.
   * Campanhas sem slug ou sem descricao são excluídas (o orquestrador precisa de ambos).
   * @param {{ escolaId?: string|null }} opts
   *   - escolaId string  → campanhas daquela escola
   *   - escolaId null/undefined → campanhas SEM escola (conteúdo "geral",
   *     usado quando o aluno não digita um código na ligação)
   */
  async listarAtivasParaOrquestrador({ escolaId } = {}) {
    const campanhas = await prisma.campanha.findMany({
      where: {
        ativa: true,
        slug: { not: null },
        descricao: { not: null },
        escolaId: escolaId ?? null,
      },
      select: { id: true, slug: true, nome: true, descricao: true },
      orderBy: { criadaEm: 'desc' },
    });
    return campanhas.map((c) => ({
      id: c.id,
      campanhaId: c.slug,
      nome: c.nome,
      descricao: c.descricao,
    }));
  },

  async buscarEscolaPorCodigo(codigo) {
    return prisma.escola.findUnique({
      where: { codigo },
      select: { id: true, codigo: true, nome: true },
    });
  },

  async buscarPorId(id) {
    return prisma.campanha.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        ativa: true,
        criadaEm: true,
        atualizadaEm: true,
        documentos: {
          select: {
            id: true,
            campanhaId: true,
            nomeOriginal: true,
            mimeType: true,
            statusIndexacao: true,
            erroIndexacao: true,
            criadoEm: true,
            atualizadoEm: true,
          },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
  },

  async buscarAtivaPorReferencia(referencia) {
    return prisma.campanha.findFirst({
      where: { ativa: true, OR: [{ id: referencia }, { slug: referencia }] },
      select: { id: true, slug: true },
    });
  },

  async atualizar(id, dados) {
    return prisma.campanha.update({
      where: { id },
      data: dados,
      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        ativa: true,
        criadaEm: true,
        atualizadaEm: true,
        // Inclui documentos para que a resposta do PATCH traga docs/documentos
        // consistentes (senão a contagem zera na tela após editar/ativar).
        documentos: {
          select: {
            id: true,
            campanhaId: true,
            nomeOriginal: true,
            mimeType: true,
            statusIndexacao: true,
            erroIndexacao: true,
            criadoEm: true,
            atualizadoEm: true,
          },
          orderBy: { criadoEm: 'desc' },
        },
      },
    });
  },

  async remover(id) {
    return prisma.campanha.delete({ where: { id } });
  },

  async contarDocumentos(id) {
    return prisma.documento.count({ where: { campanhaId: id } });
  },

  async listarDocumentos(id) {
    return prisma.documento.findMany({
      where: { campanhaId: id },
      select: { id: true, campanhaId: true },
    });
  },
};
