import { jest } from '@jest/globals';
const prisma = { $queryRaw: jest.fn(), $executeRaw: jest.fn(), $transaction: jest.fn(), campanha: { findUnique: jest.fn() } };
const embedTexts = jest.fn();
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }));
jest.unstable_mockModule('../src/services/watsonx.service.js', () => ({ embedTexts }));
const { vectorClient } = await import('../src/rag/vectorClient.js');
beforeEach(() => {
  jest.resetAllMocks();
  prisma.$queryRaw.mockResolvedValueOnce([{ nspname: 'public' }]).mockResolvedValue([]);
  embedTexts.mockResolvedValue([Array(768).fill(0.1)]);
});
test('busca sem escola é rejeitada antes de acessar embeddings ou banco', async () => {
  await expect(vectorClient.search('a1', 'Pergunta')).rejects.toMatchObject({ status: 400 });
  expect(embedTexts).not.toHaveBeenCalled(); expect(prisma.$queryRaw).not.toHaveBeenCalled();
});
test('a consulta aplica agente, escola, modelo e status PRONTO no próprio SQL', async () => {
  await vectorClient.search('a1', 'Uma dúvida.', { escolaId: 'e1', topK: 5 });
  const sql = prisma.$queryRaw.mock.calls[1][0];
  expect(sql.sql).toContain('t.agente_id = ? AND t.escola_id = ?');
  expect(sql.values).toContain('a1'); expect(sql.values).toContain('e1');
  expect(sql.sql).toContain("d.status_indexacao = 'PRONTO'");
  expect(sql.sql).toContain('t.modelo = ?');
});
test('indexação não aceita agente geral', async () => {
  prisma.campanha.findUnique.mockResolvedValue({ escolaId: null });
  await expect(vectorClient.indexChunks('geral', [])).rejects.toMatchObject({ status: 409 });
  expect(embedTexts).not.toHaveBeenCalled();
});
