import { env } from '../config/env.js';

/**
 * Divide um texto em chunks com tamanho e overlap configuráveis.
 *
 * Estratégia: quebra por parágrafo (\n\n) e agrega até CHUNK_SIZE caracteres.
 * Paragraphs maiores que CHUNK_SIZE são subdivididos por frase (". ").
 * O overlap é aplicado copiando os últimos CHUNK_OVERLAP chars do chunk anterior
 * como prefixo do próximo.
 *
 * Tradeoff documentado no .env.example:
 *   - Chunks maiores = contexto mais rico, embeddings menos precisos
 *   - Chunks menores = embeddings mais precisos, maior custo de indexação
 */
export function split(texto, {
  chunkSize = env.CHUNK_SIZE,
  chunkOverlap = env.CHUNK_OVERLAP,
} = {}) {
  if (!texto || texto.trim().length === 0) return [];

  // Divide em unidades atômicas (parágrafos, depois frases se necessário)
  const units = [];
  for (const para of texto.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.length <= chunkSize) {
      units.push(trimmed);
    } else {
      // Parágrafo grande → subdivide por frase
      const sentences = trimmed.split(/(?<=\.|\?|!)\s+/);
      units.push(...sentences.filter(Boolean));
    }
  }

  const chunks = [];
  let current = '';
  let prevTail = '';

  for (const unit of units) {
    const candidate = current ? `${current}\n${unit}` : unit;

    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(prevTail + current);
        prevTail = current.slice(-chunkOverlap);
      }
      // Unidade maior que chunkSize sozinha → força como chunk próprio
      if (unit.length > chunkSize) {
        chunks.push(prevTail + unit.slice(0, chunkSize));
        prevTail = unit.slice(Math.max(0, chunkSize - chunkOverlap), chunkSize);
        current = unit.slice(chunkSize);
      } else {
        current = unit;
      }
    }
  }

  if (current) chunks.push(prevTail + current);

  return chunks.map((texto, ordem) => ({ texto, ordem }));
}
