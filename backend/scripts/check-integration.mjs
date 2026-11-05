// Executar contra um PostgreSQL local de teste já migrado, nunca contra produção.
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import request from 'supertest';

const database = process.env.TEST_DATABASE_URL;
if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname)) {
  throw new Error('Defina TEST_DATABASE_URL para um PostgreSQL local de teste já migrado.');
}
Object.assign(process.env, {
  DATABASE_URL: database, DIRECT_URL: database, NODE_ENV: 'test', WATSONX_MOCK: 'true',
  INTERNAL_API_KEY: 'integration-only-internal-key-at-least-32-chars',
  RAG_INTERNAL_TOKEN: 'integration-only-rag-token-at-least-16-chars',
});
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/config/prisma.js');
const { watsonxClient } = await import('../src/rag/watsonxClient.js');
const auth = { Authorization: `Bearer ${process.env.INTERNAL_API_KEY}` };
const id = `integration-${randomUUID()}`;
const token = randomUUID();
const legacyCall = `integration-call-${randomUUID()}`;
const legacyKey = 'legacy:' + createHmac('sha256', process.env.INTERNAL_API_KEY).update(`legacy-call:${legacyCall}`).digest('hex');
let conversaId;
let criada = false;
try {
  const usadas = await prisma.campanha.findMany({ select: { slug: true } });
  const materia = ['matematica', 'historia', 'geografia', 'portugues', 'ciencias']
    .find(slug => !usadas.some(c => c.slug === slug));
  assert.ok(materia, 'O banco de teste deve ter ao menos um slug de matéria livre.');
  await prisma.campanha.create({ data: { id, nome: 'Turma de teste com nome personalizado', slug: materia, descricao: 'Material de teste.' } });
  criada = true;
  const ativas = await request(app).get('/campanhas/ativas');
  assert.equal(ativas.status, 200);
  assert.ok(ativas.body.some(c => c.id === id && c.campanhaId === materia));

  const criadaRes = await request(app).post('/internal/conversas').set(auth)
    .send({ chave_chamada: id, versao_chave: 'integration' });
  assert.equal(criadaRes.status, 200, JSON.stringify(criadaRes.body));
  conversaId = criadaRes.body.conversa_id;
  const pergunta = 'Quanto é dois mais dois?';
  const reserva = await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(auth)
    .send({ turno_token: token, pergunta });
  assert.equal(reserva.status, 201, JSON.stringify(reserva.body));
  const finalizada = await request(app).post('/interacoes').set(auth).send({
    conversa_id: conversaId, turno_token: token, campanha_id: id, materia,
    resposta: 'Quatro.', mensagem_retorno: 'Quatro.', status: 'RESPONDIDO',
    score_confianca_stt: 0.95, score_confianca_agente: 0.9,
  });
  assert.equal(finalizada.status, 200, JSON.stringify(finalizada.body));
  const contexto = await request(app).get(`/internal/conversas/${conversaId}/contexto`).set(auth);
  assert.equal(contexto.status, 200);
  assert.deepEqual(contexto.body.historico, [{ pergunta, resposta: 'Quatro.', materia, status: 'RESPONDIDO' }]);
  const repetida = await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(auth)
    .send({ turno_token: token, pergunta });
  assert.equal(repetida.status, 200);
  assert.equal(repetida.body.mensagem_retorno, 'Quatro.');
  assert.equal(await prisma.interacao.count({ where: { conversa_id: conversaId } }), 1);

  const legada = await request(app).post('/interacoes').set(auth).send({
    campanha_id: materia, pergunta: 'Quanto é três mais três?', resposta: 'Seis.', call_sid: legacyCall,
  });
  assert.equal(legada.status, 201, JSON.stringify(legada.body));
  assert.ok(await prisma.conversa.findUnique({ where: { chave_chamada: legacyKey } }));
  const legadoSalvo = await prisma.interacao.findUnique({ where: { id: legada.body.id } });
  assert.equal(legadoSalvo.campanha_id, id);
  assert.equal(legadoSalvo.materia, materia);

  await prisma.interacao.create({ data: {
    conversa_id: conversaId, turno_token: randomUUID(), ordem: 2, campanha_id: id, materia,
    pergunta: 'Registro vencido.', resposta: 'Resposta vencida.', status: 'RESPONDIDO',
    recebida_em: new Date(Date.now() - 8 * 86400000), expira_em: new Date(Date.now() - 86400000),
  } });
  const metricas = await request(app).get(`/analytics/campanhas/${materia}`);
  assert.equal(metricas.status, 200, JSON.stringify(metricas.body));
  assert.equal(metricas.body.totalInteracoes, 2);
  const metricasPorId = await request(app).get(`/analytics/campanhas/${id}`);
  assert.equal(metricasPorId.status, 200);
  assert.equal(metricasPorId.body.totalInteracoes, 2);
  assert.ok(metricas.body.topPerguntas.every(p => p.pergunta !== 'Registro vencido.'));
  assert.ok(metricas.body.volumePorDia.length > 0);

  await watsonxClient.indexChunks(id, [{ documentoId: 'documento-integration', ordem: 0, texto: 'Somar dois mais dois resulta em quatro.' }]);
  const rag = await request(app).get('/rag/search').set('Authorization', `Bearer ${process.env.RAG_INTERNAL_TOKEN}`)
    .query({ campanhaId: materia, query: 'quatro' });
  assert.equal(rag.status, 200, JSON.stringify(rag.body));
  assert.equal(rag.body.resultados[0].documentoId, 'documento-integration');
  const contextoAtual = await request(app).get(`/internal/conversas/${conversaId}/contexto`).set(auth);
  assert.equal(contextoAtual.body.historico.length, 1);
  const { executarExpurgo } = await import('../src/jobs/expurgo.js');
  await executarExpurgo();
  assert.equal(await prisma.interacao.count({ where: { conversa_id: conversaId } }), 1);
  console.log('Integração PostgreSQL validada: campanhas, memória, retries, contrato legado, analytics, retenção e RAG simulado.');
} finally {
  if (conversaId) await prisma.conversa.deleteMany({ where: { id: conversaId } });
  await prisma.conversa.deleteMany({ where: { chave_chamada: legacyKey } });
  if (criada) await prisma.campanha.deleteMany({ where: { id } });
  await prisma.$disconnect();
}
