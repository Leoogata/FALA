import { jest } from '@jest/globals';
const prisma = { escola: { findUnique: jest.fn() }, campanha: { findFirst: jest.fn() } };
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }));
const { selecionarAgente, agenteDaConversa } = await import('../src/services/agentConfig.service.js');
beforeEach(() => jest.resetAllMocks());
test('sem código não consulta escola nem campanhas', async () => {
  expect(await selecionarAgente(null)).toMatchObject({ modo: 'padrao', usaRag: false });
  expect(prisma.escola.findUnique).not.toHaveBeenCalled();
});
test('escola seleciona diretamente seu agente publicado', async () => {
  prisma.escola.findUnique.mockResolvedValue({ id: 'e1' });
  prisma.campanha.findFirst.mockResolvedValue({ id: 'a1', escolaId: 'e1', usaRag: true });
  expect(await selecionarAgente('1001')).toMatchObject({ id: 'a1', modo: 'escola' });
  expect(prisma.campanha.findFirst).toHaveBeenCalledWith({ where: { escolaId: 'e1', ativa: true } });
});
test('escola existente sem publicação não vira agente geral', async () => {
  prisma.escola.findUnique.mockResolvedValue({ id: 'e1' });
  prisma.campanha.findFirst.mockResolvedValue(null);
  await expect(selecionarAgente('1001')).rejects.toMatchObject({ status: 503 });
});
test('recupera vínculo e instruções originais mesmo após trocar agente publicado', async () => {
  prisma.campanha.findFirst.mockResolvedValue({ id: 'a1', escolaId: 'e1', usaRag: true, ativa: false, descricao: 'Nova instrução.' });
  const result = await agenteDaConversa({ escolaId: 'e1', agenteId: 'a1', instrucoesAgente: 'Instrução original.' });
  expect(result.descricao).toBe('Instrução original.');
  expect(prisma.campanha.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', escolaId: 'e1', usaRag: true } });
});
test('não recupera agente pertencente a outra escola', async () => {
  prisma.campanha.findFirst.mockResolvedValue(null);
  await expect(agenteDaConversa({ escolaId: 'e2', agenteId: 'a1' })).rejects.toMatchObject({ status: 503 });
});
