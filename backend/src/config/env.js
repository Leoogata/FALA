import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(10),
  CHUNK_SIZE: z.coerce.number().int().positive().default(500),
  CHUNK_OVERLAP: z.coerce.number().int().min(0).default(50),
  WATSONX_MOCK: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
