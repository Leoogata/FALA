import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(10),
  CHUNK_SIZE: z.coerce.number().int().positive().default(500),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).default(50),
  WATSONX_MOCK: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),
  // Autenticação interna entre serviços
  INTERNAL_API_KEY: z.string().min(32),
  // Parâmetros de memória de conversa
  CONTEXT_MAX_TURNS: z.coerce.number().int().positive().default(5),
  CONTEXT_MAX_CHARS: z.coerce.number().int().positive().default(8000),
  CONVERSATION_RETENTION_HOURS: z.coerce.number().int().positive().default(168),
  CONVERSATION_INACTIVITY_MINUTES: z.coerce.number().int().positive().default(30),
  // Token compartilhado para o endpoint /rag/search — requerido em produção
  RAG_INTERNAL_TOKEN: z.string().min(16, 'RAG_INTERNAL_TOKEN deve ter ao menos 16 caracteres'),
  // Número máximo de chunks retornados por busca RAG
  RAG_SEARCH_TOP_K: z.coerce.number().int().positive().max(20).default(5),
  RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.35),
  WATSONX_API_KEY: z.string().default(''),
  WATSONX_PROJECT_ID: z.string().default(''),
  WATSONX_URL: z.string().url().default('https://us-south.ml.cloud.ibm.com'),
  WATSONX_DEPLOYMENT_ID: z.string().default('01a1ac2a-64c7-748f-8215-d80978470715'),
  WATSONX_EMBEDDING_MODEL: z.string().default('ibm/granite-embedding-278m-multilingual'),
  WATSONX_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  VERSAO_PROMPT: z.string().default('agente-unico-v1'),
  // Habilita classificação local de matérias por NLU (US-10)
  // Aplicar migration antes de ativar. Desabilitar interrompe novas classificações.
  NLU_CLASSIFICACAO_HABILITADA: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
  // Chaves administrativas por escola. O código telefônico não é uma senha.
  SCHOOL_API_TOKENS: z.string().default('{}').transform((s, ctx) => {
    try {
      const tokens = z.record(z.string().regex(/^\d{4}$/), z.string().min(32)).parse(JSON.parse(s));
      if (new Set(Object.values(tokens)).size !== Object.keys(tokens).length) throw new Error('Chaves repetidas');
      return tokens;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Use um JSON { codigoEscola: chaveCom32Caracteres }' });
      return z.NEVER;
    }
  }),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
