import { env } from '../config/env.js';

// Preserva limites de parágrafo quando possível, garantindo tamanho máximo
// inclusive para frases longas e arquivos sem pontuação.
export function split(texto, { chunkSize = env.CHUNK_SIZE, chunkOverlap = env.CHUNK_OVERLAP } = {}) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || !Number.isInteger(chunkOverlap) || chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error('CHUNK_OVERLAP deve ser menor que CHUNK_SIZE e ambos devem ser inteiros válidos');
  }
  const text = texto?.trim() ?? '';
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const part = text.slice(start, end);
      const boundary = Math.max(part.lastIndexOf('\n\n'), part.lastIndexOf('. '), part.lastIndexOf(' '));
      if (boundary > Math.max(chunkSize / 2, chunkOverlap)) end = start + boundary + 1;
    }
    const content = text.slice(start, end).trim();
    if (content) chunks.push({ texto: content, ordem: chunks.length });
    if (end === text.length) break;
    start = end - chunkOverlap;
  }
  return chunks;
}
