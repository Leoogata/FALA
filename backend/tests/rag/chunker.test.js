import { split } from '../../src/rag/chunker.js';
test('frase longa é dividida sem exceder o limite nem perder conteúdo', () => {
  const texto = 'a'.repeat(2400) + 'FIM';
  const chunks = split(texto, { chunkSize: 500, chunkOverlap: 0 });
  expect(chunks.every((c) => c.texto.length <= 500)).toBe(true);
  expect(chunks.map((c) => c.texto).join('')).toBe(texto);
});
test('overlap preserva o final do trecho anterior', () => {
  const chunks = split('abcdefghij'.repeat(20), { chunkSize: 50, chunkOverlap: 10 });
  expect(chunks[1].texto.slice(0, 10)).toBe(chunks[0].texto.slice(-10));
  expect(chunks.every((c) => c.texto.length <= 50)).toBe(true);
});
test('configuração inválida não entra em loop', () => {
  expect(() => split('texto', { chunkSize: 10, chunkOverlap: 10 })).toThrow('CHUNK_OVERLAP');
});
