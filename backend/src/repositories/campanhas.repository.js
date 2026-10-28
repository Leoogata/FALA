import prisma from '../config/prisma.js';

export const campanhasRepository = {
  async criar({ nome, descricao }) {
    return prisma.campanha.create({
      data: { nome, descricao },
      select: { id: true, nome: true, descricao: true, ativa: true, criadaEm: true },
    });
  },

  async listar({ ativa } = {}) {
    return prisma.campanha.findMany({
      where: ativa !== undefined ? { ativa } : undefined,
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativa: true,
        criadaEm: true,
        _count: { select: { documentos: true } },
      },
      orderBy: { criadaEm: 'desc' },
    });
  },

  async buscarPorId(id) {
    return prisma.campanha.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativa: true,
        criadaEm: true,
        atualizadaEm: true,
        documentos: {
          select: {
            id: true,
            nomeOriginal: true,
            mimeType: true,
            statusIndexacao: true,
            criadoEm: true,
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
