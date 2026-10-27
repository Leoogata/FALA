import fs from 'fs/promises';
import { documentosRepository } from '../repositories/documentos.repository.js';
import { campanhasRepository } from '../repositories/campanhas.repository.js';
import { createError } from '../middlewares/errorHandler.js';
import { queue } from '../rag/queue.js';

export const documentosService = {
  async listar(campanhaId, { status } = {}) {
    const campanha = await campanhasRepository.buscarPorId(campanhaId);
    if (!campanha) throw createError(404, 'Campanha não encontrada');
    return documentosRepository.listarPorCampanha(campanhaId, { status });
  },

  async buscarPorId(campanhaId, docId) {
    const campanha = await campanhasRepository.buscarPorId(campanhaId);
    if (!campanha) throw createError(404, 'Campanha não encontrada');
    const documento = await documentosRepository.buscarPorIdECampanha(docId, campanhaId);
    if (!documento) throw createError(404, 'Documento não encontrado');
    return documento;
  },

  /**
   * Persiste o arquivo no banco e enfileira a indexação RAG.
   * Retorna o documento com status PROCESSANDO — a indexação ocorre em background.
   */
  async upload(campanhaId, file) {
    const campanha = await campanhasRepository.buscarPorId(campanhaId);
    if (!campanha) {
      // Arquivo já foi salvo pelo Multer — limpa antes de lançar erro
      await fs.unlink(file.path).catch(() => {});
      throw createError(404, 'Campanha não encontrada');
    }

    const documento = await documentosRepository.criar({
      campanhaId,
      nomeOriginal: file.originalname,
      mimeType: file.mimetype,
      caminhoArquivo: file.path,
    });

    queue.enqueue({ documentoId: documento.id, campanhaId, caminhoArquivo: file.path });

    return documento;
  },

  /**
   * Remove um documento do banco e seus chunks no watsonx.
   * Permitido mesmo em status PROCESSANDO (ver plano, suposição 8).
   */
  async remover(campanhaId, docId) {
    const campanha = await campanhasRepository.buscarPorId(campanhaId);
    if (!campanha) throw createError(404, 'Campanha não encontrada');

    const documento = await documentosRepository.buscarPorIdECampanha(docId, campanhaId);
    if (!documento) throw createError(404, 'Documento não encontrado');

    // Tenta remover chunks do watsonx antes de apagar o registro.
    // Se falhar → 502, registro permanece no banco (sem estado inconsistente).
    const { watsonxClient } = await import('../rag/watsonxClient.js');
    await watsonxClient.deleteDocumentChunks(campanhaId, docId);

    await documentosRepository.remover(docId);
  },
};
