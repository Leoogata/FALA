import { documentosService } from '../services/documentos.service.js';

export const documentosController = {
  async listar(req, res, next) {
    try {
      const documentos = await documentosService.listar(req.params.id, req.query);
      res.json(documentos);
    } catch (err) {
      next(err);
    }
  },

  async buscarPorId(req, res, next) {
    try {
      const documento = await documentosService.buscarPorId(req.params.id, req.params.docId);
      res.json(documento);
    } catch (err) {
      next(err);
    }
  },

  async upload(req, res, next) {
    try {
      // req.file é populado pelo Multer antes de chegar aqui
      const documento = await documentosService.upload(req.params.id, req.file);
      res.status(201).json(documento);
    } catch (err) {
      next(err);
    }
  },

  async remover(req, res, next) {
    try {
      await documentosService.remover(req.params.id, req.params.docId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
