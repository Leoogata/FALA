import { jest } from '@jest/globals';
import request from 'supertest';

process.env.SCHOOL_API_TOKENS = JSON.stringify({ '1001': 'school-a-secret-key-at-least-32-characters',
  '2002': 'school-b-secret-key-at-least-32-characters' });
const escolas = { '1001': { id: 'e1', codigo: '1001', nome: 'Escola A' }, '2002': { id: 'e2', codigo: '2002', nome: 'Escola B' } };
const agentes = { a1: { id: 'a1', escolaId: 'e1', usaRag: true, nome: 'Tutor', documentos: [] } };
const prisma = { escola: { findUnique: jest.fn(({ where }) => escolas[where.codigo]) },
  campanha: { findFirst: jest.fn(({ where }) => Object.values(agentes).find((a) => a.id === where.id && a.escolaId === where.escolaId)) } };
const repo = { listar: jest.fn().mockResolvedValue([]), criar: jest.fn(), buscarPorId: jest.fn() };
const gerarResposta = jest.fn();
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: prisma }));
jest.unstable_mockModule('../src/repositories/campanhas.repository.js', () => ({ campanhasRepository: repo }));
jest.unstable_mockModule('../src/services/educational.service.js', () => ({ gerarResposta }));
const { default: app } = await import('../src/app.js');
const authA = { Authorization: 'Bearer school-a-secret-key-at-least-32-characters' };
const authB = { Authorization: 'Bearer school-b-secret-key-at-least-32-characters' };
beforeEach(() => {
  jest.clearAllMocks();
  repo.criar.mockResolvedValue(agentes.a1);
  repo.buscarPorId.mockResolvedValue(agentes.a1);
  gerarResposta.mockResolvedValue({ resposta: 'Vinte mililitros.', sem_resposta: false });
});
test('código telefônico não autentica administração', async () => {
  expect((await request(app).get('/campanhas').set('Authorization', 'Bearer 1001')).status).toBe(401);
});
test('login retorna somente a escola da chave', async () => {
  expect((await request(app).get('/painel/escola').set(authA)).body).toEqual(escolas['1001']);
});
test('listagem ignora escola enviada pelo cliente e usa escola autenticada', async () => {
  const res = await request(app).get('/campanhas?escolaId=e2').set(authA);
  expect(res.status).toBe(200);
  expect(repo.listar).toHaveBeenCalledWith({ escolaId: 'e1', ativa: undefined });
});
test('criação força escola e RAG pelo contexto autenticado', async () => {
  const res = await request(app).post('/campanhas').set(authA).send({ nome: 'Novo tutor', escolaId: 'e2', usaRag: false });
  expect(res.status).toBe(201);
  expect(repo.criar).toHaveBeenCalledWith({ nome: 'Novo tutor', escolaId: 'e1' });
});
test.each([
  ['get', '/campanhas/a1'], ['patch', '/campanhas/a1'], ['delete', '/campanhas/a1'],
  ['get', '/campanhas/a1/documentos'], ['post', '/campanhas/a1/documentos'],
  ['delete', '/campanhas/a1/documentos/d1'], ['post', '/campanhas/a1/testar'],
  ['get', '/analytics/campanhas/a1'],
])('escola B não acessa escola A: %s %s', async (method, path) => {
  const res = await request(app)[method](path).set(authB).send({ pergunta: 'Qual a data?', nome: 'Outro nome' });
  expect(res.status).toBe(404); expect(gerarResposta).not.toHaveBeenCalled();
});
test('teste do painel usa o mesmo serviço de geração da voz', async () => {
  const res = await request(app).post('/campanhas/a1/testar').set(authA).send({ pergunta: 'Quanto de água?' });
  expect(res.status).toBe(200);
  expect(gerarResposta).toHaveBeenCalledWith({ agente: { ...agentes.a1, modo: 'escola' }, pergunta: 'Quanto de água?', historico: [] });
});
