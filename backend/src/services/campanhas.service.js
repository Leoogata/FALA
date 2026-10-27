import { campanhasRepository } from '../repositories/campanhas.repository.js';
import { createError } from '../middlewares/errorHandler.js';
import prisma from '../config/prisma.js';

export const campanhasService = {
  async criar({ nome }) {
    return campanhasRepository.criar({ nome });
  },

  async listar({ ativa } = {}) {
    return campanhasRepository.listar({ ativa });
  },

  async buscarPorId(id) {
    const campanha = await campanhasRepository.buscarPorId(id);
    if (!campanha) throw createError(404, 'Campanha não encontrada');
    return campanha;
  },

  async atualizar(id, dados) {
    const existe = await campanhasRepository.buscarPorId(id);
    if (!existe) throw createError(404, 'Campanha não encontrada');
    return campanhasRepository.atualizar(id, dados);
  },

  /**
   * Remove uma campanha.
   *
   * Sem cascade (default): falha com 409 se houver documentos.
   * Com cascade: o controller passa `deletarChunksFn` e esta função
   * limpa os chunks no watsonx antes de deletar banco — sem estado parcial.
   *
   * @param {string} id
   * @param {{ cascade?: boolean, deletarChunksFn?: Function }} opts
   */
  async remover(id, { cascade = false, deletarChunksFn } = {}) {
    const existe = await campanhasRepository.buscarPorId(id);
    if (!existe) throw createError(404, 'Campanha não encontrada');

    if (!cascade) {
      const total = await campanhasRepository.contarDocumentos(id);
      if (total > 0) {
        throw createError(
          409,
          `Campanha possui ${total} documento(s). Use ?cascade=true para remover tudo, ou remova os documentos manualmente antes.`,
        );
      }
      return campanhasRepository.remover(id);
    }

    // cascade=true — limpa chunks watsonx primeiro, depois banco em transação
    const documentos = await campanhasRepository.listarDocumentos(id);

    for (const doc of documentos) {
      await deletarChunksFn(doc.campanhaId, doc.id);
    }

    await prisma.$transaction([
      prisma.documento.deleteMany({ where: { campanhaId: id } }),
      prisma.campanha.delete({ where: { id } }),
    ]);
  },
};
