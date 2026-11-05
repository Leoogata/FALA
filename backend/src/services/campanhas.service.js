import { campanhasRepository } from '../repositories/campanhas.repository.js';
import { createError } from '../middlewares/errorHandler.js';
import prisma from '../config/prisma.js';

export const campanhasService = {
  async criar({ nome, slug, descricao }) {
    return campanhasRepository.criar({ nome, slug, descricao });
  },

  async listar({ ativa } = {}) {
    return campanhasRepository.listar({ ativa });
  },

  /**
   * Campanhas ativas para o orquestrador.
   * Se `codigoEscola` for informado, resolve a escola e filtra as campanhas
   * dela; se a escola não existir, lança 404. Sem código, retorna as
   * campanhas "gerais" (sem escola).
   */
  async listarAtivasParaOrquestrador({ codigoEscola } = {}) {
    let escolaId; // undefined → o repo trata como null (geral)
    if (codigoEscola) {
      const escola = await campanhasRepository.buscarEscolaPorCodigo(codigoEscola);
      if (!escola) throw createError(404, 'Escola não encontrada para o código informado');
      escolaId = escola.id;
    }
    return campanhasRepository.listarAtivasParaOrquestrador({ escolaId });
  },

  async buscarEscolaPorCodigo(codigo) {
    const escola = await campanhasRepository.buscarEscolaPorCodigo(codigo);
    if (!escola) throw createError(404, 'Escola não encontrada');
    return escola;
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
