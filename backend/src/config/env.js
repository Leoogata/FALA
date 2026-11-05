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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
