// Configuração isolada: testes não dependem de credenciais do ambiente real.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.INTERNAL_API_KEY = 'test-only-internal-key-at-least-32-characters';
process.env.RAG_INTERNAL_TOKEN = 'test-only-rag-token-at-least-16-characters';
process.env.WATSONX_MOCK = 'true';
