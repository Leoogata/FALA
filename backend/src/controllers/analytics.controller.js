import { analyticsService } from '../services/analytics.service.js';

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
};
