import { analyticsService, agregarMateriasPorEscola } from '../services/analytics.service.js';

export const analyticsController = {
  async campanhas(req, res, next) {
    try {
      const { campanhaId } = req.params;
      const { dias, top } = req.query;
      const dados = await analyticsService.agregarPorCampanha(campanhaId, { dias, top });
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },

  async materias(req, res, next) {
    try {
      const { dias } = req.query;
      const escolaId = req.escola.id;
      const dados = await agregarMateriasPorEscola(escolaId, { dias });
      res.set('Cache-Control', 'private, no-store');
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },
};
