import { campanhasService } from '../services/campanhas.service.js';

// O watsonxClient é importado dinamicamente pelo controller apenas no caminho cascade,
// para manter o acoplamento explícito e facilitar mock em testes.
async function getWatsonxClient() {
  const { watsonxClient } = await import('../rag/watsonxClient.js');
  return watsonxClient;
}

export const campanhasController = {
  async criar(req, res, next) {
    try {
      const campanha = await campanhasService.criar(req.body);
      res.status(201).json(campanha);
    } catch (err) {
      next(err);
    }
  },

  async listar(req, res, next) {
    try {
      const campanhas = await campanhasService.listar(req.query);
      res.json(campanhas);
    } catch (err) {
      next(err);
    }
  },

  async buscarPorId(req, res, next) {
    try {
      const campanha = await campanhasService.buscarPorId(req.params.id);
      res.json(campanha);
    } catch (err) {
      next(err);
    }
  },

  async atualizar(req, res, next) {
    try {
      const campanha = await campanhasService.atualizar(req.params.id, req.body);
      res.json(campanha);
    } catch (err) {
      next(err);
    }
  },

  async remover(req, res, next) {
    try {
      const cascade = req.query.cascade === true; // já coercido pelo validate()

      let deletarChunksFn;
      if (cascade) {
        const client = await getWatsonxClient();
        deletarChunksFn = client.deleteDocumentChunks;
      }

      await campanhasService.remover(req.params.id, { cascade, deletarChunksFn });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
