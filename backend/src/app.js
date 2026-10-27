import express from 'express';
import router from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
// Importar o pipeline registra o handler na fila ao iniciar o app
import './rag/pipeline.js';

const app = express();

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas (inclui /api-docs)
app.use('/', router);

// Middleware de erro — deve ser o último
app.use(errorHandler);

export default app;
