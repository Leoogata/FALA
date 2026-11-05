import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../docs/swagger.js';
import campanhasRouter from './campanhas.routes.js';
import escolasRouter from './escolas.routes.js';
import documentosRouter from './documentos.routes.js';
import conversasRouter from './conversas.routes.js';
import interacoesRouter from './interacoes.routes.js';
import instrucoesRouter from './instrucoes.routes.js';
import testarRouter from './testar.routes.js';
import analyticsRouter from './analytics.routes.js';
import ragRouter from './rag.routes.js';

const router = Router();

// Documentação Swagger — servida em /api-docs
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rotas de negócio
router.use('/campanhas', campanhasRouter);
// Escolas — resolve código digitado na URA → escola (filtra campanhas por escola)
router.use('/escolas', escolasRouter);
// Documentos vivem sob /campanhas/:id/documentos
router.use('/campanhas/:id/documentos', documentosRouter);
// Testar agente
router.use('/campanhas/:id/testar', testarRouter);
// Instruções (melhorar com IA)
router.use('/instrucoes', instrucoesRouter);
// Analytics — ingestão e consulta de interações
router.use('/interacoes', interacoesRouter);
router.use('/analytics', analyticsRouter);
// RAG search — endpoint interno para context injection (telephony-handler → backend)
router.use('/rag', ragRouter);

// Endpoints internos de memória de conversa (US-08/US-09)
router.use('/internal/conversas', conversasRouter);

export default router;
