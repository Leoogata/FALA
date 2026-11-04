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
   * Retorna campanhas ativas no formato esperado pelo orquestrador watsonx:
   * { campanhaId, nome, descricao }
   * Campanhas sem slug ou sem descricao são excluídas:
   *   - slug é usado como campanhaId pelo orquestrador para rotear para o agente correto
   *   - descricao é usada pelo orquestrador para classificar a pergunta
   */
  async listarAtivasParaOrquestrador() {
    const campanhas = await prisma.campanha.findMany({
      where: { ativa: true, slug: { not: null }, descricao: { not: null } },
      select: { slug: true, nome: true, descricao: true },
      orderBy: { criadaEm: 'desc' },
    });
    return campanhas.map((c) => ({
      campanhaId: c.slug,
      nome: c.nome,
      descricao: c.descricao,
    }));
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
