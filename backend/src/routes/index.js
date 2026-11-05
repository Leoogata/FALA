import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../docs/swagger.js';
import campanhasRouter from './campanhas.routes.js';
import documentosRouter from './documentos.routes.js';
import conversasRouter from './conversas.routes.js';
import interacoesRouter from './interacoes.routes.js';

const router = Router();

// Documentação Swagger — servida em /api-docs
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas de negócio
router.use('/campanhas', campanhasRouter);
// Documentos vivem sob /campanhas/:id/documentos
router.use('/campanhas/:id/documentos', documentosRouter);

// Endpoints internos de memória de conversa (US-08/US-09)
router.use('/internal/conversas', conversasRouter);
router.use('/interacoes', interacoesRouter);

export default router;
