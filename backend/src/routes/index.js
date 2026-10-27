import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../docs/swagger.js';
import campanhasRouter from './campanhas.routes.js';
import documentosRouter from './documentos.routes.js';

const router = Router();

// Documentação Swagger — servida em /api-docs
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas de negócio
router.use('/campanhas', campanhasRouter);
// Documentos vivem sob /campanhas/:id/documentos
router.use('/campanhas/:id/documentos', documentosRouter);

export default router;
