import prisma from '../config/prisma.js';

export const documentosRepository = {
  async criar({ campanhaId, nomeOriginal, mimeType, caminhoArquivo }) {
    return prisma.documento.create({
      data: { campanhaId, nomeOriginal, mimeType, caminhoArquivo },
      select: {
        id: true,
        campanhaId: true,
        nomeOriginal: true,
        mimeType: true,
        statusIndexacao: true,
        criadoEm: true,
      },
    });
  },

  async buscarPorId(id) {
    return prisma.documento.findUnique({ where: { id } });
  },

  async listarPorCampanha(campanhaId, { status } = {}) {
    return prisma.documento.findMany({
      where: {
        campanhaId,
        ...(status ? { statusIndexacao: status } : {}),
      },
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
    });
  },

  async buscarPorIdECampanha(id, campanhaId) {
    return prisma.documento.findFirst({
      where: { id, campanhaId },
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
    });
  },

  async remover(id) {
    return prisma.documento.delete({ where: { id } });
  },

  async atualizarStatus(id, statusIndexacao, erroIndexacao = null) {
    return prisma.documento.update({
      where: { id },
      data: {
        statusIndexacao,
        ...(erroIndexacao !== null ? { erroIndexacao } : {}),
      },
    });
  },
};
