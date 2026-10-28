import express from 'express';
import cors from 'cors';
import router from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
// Importar o pipeline registra o handler na fila ao iniciar o app
import './rag/pipeline.js';

const app = express();

// CORS — permite o painel front-end (Vite dev ou produção) consumir a API
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas (inclui /api-docs)
app.use('/', router);

// Middleware de erro — deve ser o último
app.use(errorHandler);

export default app;
