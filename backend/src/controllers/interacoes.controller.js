import { interacoesService } from '../services/interacoes.service.js';

export const interacoesController = {
  async registrar(req, res, next) {
    try {
      const resultado = await interacoesService.registrar(req.body);
      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  },
};
