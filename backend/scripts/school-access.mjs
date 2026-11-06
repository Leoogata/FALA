// Executar na pasta backend. Grava a chave somente no .env local, ignorado pelo Git.
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
const codigo = process.argv[2];
if (!/^\d{4}$/.test(codigo ?? '')) throw new Error('Uso: npm run escola:chave -- 1001');
const path = new URL('../.env', import.meta.url);
const original = await fs.readFile(path, 'utf8');
const config = dotenv.parse(original);
const tokens = JSON.parse(config.SCHOOL_API_TOKENS ?? '{}');
if (tokens[codigo]) {
  console.log('A escola já possui uma chave no SCHOOL_API_TOKENS do .env. Nenhuma alteração feita.');
} else {
  tokens[codigo] = randomBytes(32).toString('hex');
  const line = `SCHOOL_API_TOKENS='${JSON.stringify(tokens)}'`;
  const content = /^SCHOOL_API_TOKENS=.*$/m.test(original)
    ? original.replace(/^SCHOOL_API_TOKENS=.*$/m, () => line)
    : `${original}\n${line}\n`;
  await fs.writeFile(path, content);
  console.log(`Chave criada para a escola ${codigo}. Consulte SCHOOL_API_TOKENS no .env e reinicie o backend.`);
}
