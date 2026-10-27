import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Ponte — API de Campanhas e Documentos',
      version: '1.0.0',
      description:
        'API REST para gerenciamento de campanhas didáticas e documentos indexados via RAG no watsonx. ' +
        'Parte da plataforma Ponte — ensino via chamada telefônica para regiões sensíveis.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desenvolvimento local' },
    ],
    tags: [
      { name: 'Campanhas', description: 'CRUD de campanhas didáticas' },
      { name: 'Documentos', description: 'Upload e remoção de documentos por campanha' },
    ],
    components: {
      schemas: {
        Campanha: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1abc2def3ghi4jkl5' },
            nome: { type: 'string', example: 'Matemática — 9º ano EF' },
            descricao: {
              type: 'string',
              nullable: true,
              example: 'Você é um tutor de matemática do ensino fundamental. Responda de forma simples e didática, usando exemplos do cotidiano.',
              description: 'System prompt do agente educacional desta campanha. Null = usa o prompt padrão.',
            },
            ativa: { type: 'boolean', example: true },
            criadaEm: { type: 'string', format: 'date-time' },
            atualizadaEm: { type: 'string', format: 'date-time' },
          },
        },
        Documento: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx9xyz0abc1def2ghi3' },
            campanhaId: { type: 'string' },
            nomeOriginal: { type: 'string', example: 'apostila-mat.pdf' },
            mimeType: {
              type: 'string',
              enum: ['application/pdf', 'text/plain'],
            },
            statusIndexacao: {
              type: 'string',
              enum: ['PROCESSANDO', 'PRONTO', 'ERRO'],
            },
            erroIndexacao: { type: 'string', nullable: true },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        Erro: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Recurso não encontrado' },
          },
        },
      },
    },
  },
  // Rotas com JSDoc serão adicionadas nas etapas seguintes
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
