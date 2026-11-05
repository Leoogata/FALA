import { jest } from '@jest/globals';
import request from 'supertest';

const conversaId = '11111111-1111-4111-8111-111111111111';
const turnoToken = '22222222-2222-4222-8222-222222222222';
const conversa = {
  upsertConversa: jest.fn(), buscarContexto: jest.fn(), reservarTurno: jest.fn(),
  concluirTurno: jest.fn(), encerrarConversa: jest.fn(),
};
const legado = { registrar: jest.fn() };
const campanhas = { buscarAtivaPorReferencia: jest.fn() };
jest.unstable_mockModule('../src/services/conversas.service.js', () => conversa);
jest.unstable_mockModule('../src/services/interacoes.service.js', () => ({ interacoesService: legado }));
jest.unstable_mockModule('../src/repositories/campanhas.repository.js', () => ({ campanhasRepository: campanhas }));

// Importa a aplicação e suas rotas reais: detecta erros que testes só de service não veem.
const { default: app } = await import('../src/app.js');
const { watsonxClient } = await import('../src/rag/watsonxClient.js');
const auth = () => ({ Authorization: `Bearer ${process.env.INTERNAL_API_KEY}` });

beforeEach(() => {
  jest.clearAllMocks();
  watsonxClient._reset();
  conversa.upsertConversa.mockResolvedValue({ id: conversaId, estado: 'ATIVA' });
  conversa.reservarTurno.mockResolvedValue({ id: 'turno-1', ordem: 1, status: 'RECEBIDO', jaExistia: false });
  conversa.concluirTurno.mockResolvedValue({ id: 'turno-1', status: 'RESPONDIDO' });
});

test('aplicação carrega e serve documentação das rotas', async () => {
  expect((await request(app).get('/api-docs/')).status).toBe(200);
});

test('rotas internas exigem autenticação', async () => {
  expect((await request(app).post('/internal/conversas').send({})).status).toBe(401);
});

test('cria conversa e valida o body no formato do middleware', async () => {
  const body = { chave_chamada: 'hmac-teste', versao_chave: 'v1' };
  const res = await request(app).post('/internal/conversas').set(auth()).send(body);
  expect(res.status).toBe(200);
  expect(res.body.conversa_id).toBe(conversaId);
  expect(conversa.upsertConversa).toHaveBeenCalledWith({ chaveChamada: body.chave_chamada, versaoChave: 'v1' });
  expect((await request(app).post('/internal/conversas').set(auth()).send({})).status).toBe(400);
});

test('reserva turno, rejeita token inválido e encerra conversa', async () => {
  const res = await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(auth())
    .send({ turno_token: turnoToken, pergunta: 'Qual a capital do Brasil?' });
  expect(res.status).toBe(201);
  expect(conversa.reservarTurno).toHaveBeenCalledTimes(1);
  expect((await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(auth())
    .send({ turno_token: 'invalido' })).status).toBe(400);
  expect((await request(app).patch(`/internal/conversas/${conversaId}`).set(auth())
    .send({ estado: 'ENCERRADA' })).status).toBe(200);
});

test('finalização usa somente o contrato de conversa', async () => {
  const res = await request(app).post('/interacoes').set(auth()).send({
    conversa_id: conversaId, turno_token: turnoToken, resposta: 'Brasília.',
    mensagem_retorno: 'Brasília.', status: 'RESPONDIDO',
  });
  expect(res.status).toBe(200);
  expect(conversa.concluirTurno).toHaveBeenCalledTimes(1);
  expect(legado.registrar).not.toHaveBeenCalled();
});

test('contrato legado mantém compatibilidade sem capturar finalização malformada', async () => {
  legado.registrar.mockResolvedValue({ id: 'legado-1', criadoEm: new Date() });
  const body = { campanha_id: 'historia', pergunta: 'Quem foi Dom Pedro I?', call_sid: 'CA-teste' };
  expect((await request(app).post('/interacoes').set(auth()).send(body)).status).toBe(201);
  expect(legado.registrar).toHaveBeenCalledTimes(1);
  expect((await request(app).post('/interacoes').set(auth()).send({ ...body, conversa_id: 'invalida' })).status).toBe(400);
  expect(legado.registrar).toHaveBeenCalledTimes(1);
});

test('busca por matéria recupera os documentos indexados pelo ID real', async () => {
  campanhas.buscarAtivaPorReferencia.mockResolvedValue({ id: 'campanha-real', slug: 'historia' });
  await watsonxClient.indexChunks('campanha-real', [{ documentoId: 'doc-1', ordem: 0, texto: 'Independência do Brasil.' }]);
  const res = await request(app).get('/rag/search').set('Authorization', `Bearer ${process.env.RAG_INTERNAL_TOKEN}`)
    .query({ campanhaId: 'historia', query: 'Independência' });
  expect(res.status).toBe(200);
  expect(res.body.resultados[0].texto).toBe('Independência do Brasil.');
  expect(campanhas.buscarAtivaPorReferencia).toHaveBeenCalledWith('historia');
});
