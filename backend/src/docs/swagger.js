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
      { name: 'Analytics', description: 'Ingestão e consulta de interações de voz (anônimas)' },
      { name: 'RAG', description: 'Busca semântica nos índices RAG por campanha (endpoint interno)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token interno fixo (RAG_INTERNAL_TOKEN). Use para autenticar /rag/search.',
        },
      },
      schemas: {
        Campanha: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1abc2def3ghi4jkl5' },
            nome: { type: 'string', example: 'Matemática — 9º ano EF' },
            slug: {
              type: 'string',
              nullable: true,
              enum: ['historia', 'geografia', 'portugues', 'matematica', 'ciencias'],
              example: 'matematica',
              description:
                'Identificador semântico. Usado pelo orquestrador watsonx como campanhaId para roteamento de voz. ' +
                'Campanhas sem slug não aparecem em GET /campanhas/ativas.',
            },
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
        Interacao: {
          type: 'object',
          description: 'Registro de interação de voz — dado estritamente anônimo',
          properties: {
            id: { type: 'string', example: 'clx9xyz0abc1def2ghi3' },
            campanhaId: {
              type: 'string',
              example: 'matematica',
              description: 'Slug semântico da campanha',
            },
            pergunta: { type: 'string', example: 'O que é equação do segundo grau?' },
            resposta: { type: 'string', nullable: true },
            scoreConfiancaStt: { type: 'number', format: 'float', nullable: true },
            scoreConfiancaAgente: { type: 'number', format: 'float', nullable: true },
            semResposta: { type: 'boolean' },
            callSid: { type: 'string', example: 'CA0123456789abcdef' },
            criadoEm: { type: 'string', format: 'date-time' },
          },
        },
        AnalyticsCampanha: {
          type: 'object',
          properties: {
            campanhaId: { type: 'string', example: 'matematica' },
            totalInteracoes: { type: 'integer', example: 142 },
            percentualSemResposta: {
              type: 'number',
              format: 'float',
              example: 12.7,
              description: '% de turnos onde o agente não soube responder',
            },
            topPerguntas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pergunta: { type: 'string' },
                  total: { type: 'integer' },
                },
              },
            },
            volumePorDia: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  data: { type: 'string', format: 'date', example: '2025-07-01' },
                  total: { type: 'integer' },
                },
              },
            },
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
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
