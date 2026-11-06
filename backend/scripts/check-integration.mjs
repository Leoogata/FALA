// Validação isolada em PostgreSQL local com pgvector. Nunca utiliza banco remoto.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

const database = process.env.TEST_DATABASE_URL;
if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname)) {
  throw new Error('Defina TEST_DATABASE_URL para um PostgreSQL local de teste já migrado.');
}
const tokens = { '9001': 'integration-school-a-secret-at-least-32-characters',
  '9002': 'integration-school-b-secret-at-least-32-characters' };
Object.assign(process.env, {
  DATABASE_URL: database, DIRECT_URL: database, NODE_ENV: 'test', WATSONX_MOCK: 'false',
  INTERNAL_API_KEY: 'integration-only-internal-key-at-least-32-chars',
  RAG_INTERNAL_TOKEN: 'integration-only-rag-token-at-least-16-chars',
  SCHOOL_API_TOKENS: JSON.stringify(tokens), WATSONX_API_KEY: 'integration-fake-ibm-key',
  WATSONX_PROJECT_ID: 'integration-project',
});
// Simula somente a IBM. O banco, pgvector, HTTP, upload e pipeline são reais.
const generationInputs = [];
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://iam.cloud.ibm.com/')) {
    return Response.json({ access_token: 'integration-token', expires_in: 3600 });
  }
  const payload = JSON.parse(options.body);
  if (String(url).includes('/text/embeddings')) {
    return Response.json({ results: payload.inputs.map(() => ({ embedding: Array(768).fill(0.1) })) });
  }
  const input = JSON.parse(payload.parameters.prompt_variables.input);
  generationInputs.push(input);
  return Response.json({ results: [{ generated_text: JSON.stringify({
    resposta: input.modo === 'padrao' ? 'Quatro.' : input.contexto_rag,
    confianca: 0.9, sem_resposta: false, precisa_esclarecimento: false, pergunta_esclarecimento: '',
  }) }] });
};
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/config/prisma.js');
const { vectorClient } = await import('../src/rag/vectorClient.js');
const { processar } = await import('../src/rag/pipeline.js');
const { env } = await import('../src/config/env.js');
const serviceAuth = { Authorization: `Bearer ${process.env.INTERNAL_API_KEY}` };
const authA = { Authorization: `Bearer ${tokens['9001']}` };
const authB = { Authorization: `Bearer ${tokens['9002']}` };
const escolas = [];
const agentes = [];
const conversas = [];
const arquivos = [];
const id = randomUUID();
const fs = await import('node:fs/promises');
try {
  for (const codigo of Object.keys(tokens)) {
    escolas.push(await prisma.escola.create({ data: { codigo, nome: `Escola de teste ${codigo}` } }));
  }
  for (const [auth, marker] of [[authA, 'MATERIAL EXCLUSIVO DA ESCOLA ALFA.'], [authB, 'MATERIAL EXCLUSIVO DA ESCOLA BETA.']]) {
    const created = await request(app).post('/campanhas').set(auth).send({ nome: 'Tutor escolar', slug: 'tutor' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const agenteId = created.body.id;
    agentes.push(agenteId);
    assert.equal((await request(app).patch(`/campanhas/${agenteId}`).set(auth).send({ ativa: true })).status, 409);
    const upload = await request(app).post(`/campanhas/${agenteId}/documentos`).set(auth)
      .attach('arquivo', Buffer.from(marker), 'material.txt');
    assert.equal(upload.status, 201, JSON.stringify(upload.body));
    const doc = await prisma.documento.findUnique({ where: { id: upload.body.id } });
    arquivos.push(doc.caminhoArquivo);
    // Aguarda o mesmo pipeline usado pelo upload (embeddings IBM simulados).
    for (let i = 0; i < 60; i++) {
      const d = await prisma.documento.findUnique({ where: { id: doc.id } });
      if (d.statusIndexacao === 'PRONTO') break;
      assert.notEqual(d.statusIndexacao, 'ERRO', d.erroIndexacao);
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal((await prisma.documento.findUnique({ where: { id: doc.id } })).statusIndexacao, 'PRONTO');
    assert.equal((await request(app).patch(`/campanhas/${agenteId}`).set(auth).send({ ativa: true })).status, 200);
  }
  assert.equal((await request(app).get('/campanhas').set(authA)).body.length, 1);
  assert.equal((await request(app).get(`/campanhas/${agentes[0]}/documentos`).set(authB)).status, 404);
  assert.equal((await request(app).post(`/campanhas/${agentes[0]}/testar`).set(authB).send({ pergunta: 'Qual material?' })).status, 404);
  assert.equal((await vectorClient.search(agentes[0], 'material', { escolaId: escolas[1].id })).resultados.length, 0);
  const tested = await request(app).post(`/campanhas/${agentes[0]}/testar`).set(authA).send({ pergunta: 'Qual material?' });
  assert.equal(tested.status, 200, JSON.stringify(tested.body));
  assert.match(tested.body.resposta, /ALFA/); assert.doesNotMatch(tested.body.resposta, /BETA/);

  // Reindexar o documento substitui seus trechos em vez de duplicá-los.
  const doc = await prisma.documento.findFirst({ where: { campanhaId: agentes[0] } });
  await processar({ documentoId: doc.id, campanhaId: agentes[0], caminhoArquivo: doc.caminhoArquivo });
  const [count] = await prisma.$queryRaw`SELECT count(*)::int AS n FROM documento_trechos WHERE documento_id = ${doc.id}`;
  assert.equal(count.n, 1);

  for (const codigo of [null, '9001']) {
    const chave = `${id}-${codigo}`;
    const created = await request(app).post('/internal/conversas').set(serviceAuth)
      .send({ chave_chamada: chave, versao_chave: 'test', codigo_escola: codigo });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const conversaId = created.body.conversa_id;
    conversas.push(conversaId);
    const turnoToken = randomUUID();
    assert.equal((await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(serviceAuth)
      .send({ turno_token: turnoToken, pergunta: codigo ? 'Qual material?' : 'Quanto é dois mais dois?' })).status, 201);
    const answer = await request(app).post('/internal/respostas').set(serviceAuth)
      .send({ conversa_id: conversaId, turno_token: turnoToken });
    assert.equal(answer.status, 200, JSON.stringify(answer.body));
    assert.equal(generationInputs.at(-1).modo, codigo ? 'escola' : 'padrao');
    assert.equal(answer.body.campanha_id, codigo ? agentes[0] : null);
    if (!codigo) assert.equal(generationInputs.at(-1).contexto_rag, '');
    const final = await request(app).post('/interacoes').set(serviceAuth).send({
      conversa_id: conversaId, turno_token: turnoToken, campanha_id: answer.body.campanha_id,
      resposta: answer.body.resposta, mensagem_retorno: answer.body.resposta, status: 'RESPONDIDO', fontes: answer.body.fontes,
    });
    assert.equal(final.status, 200, JSON.stringify(final.body));
    const retry = await request(app).post(`/internal/conversas/${conversaId}/turnos`).set(serviceAuth)
      .send({ turno_token: turnoToken, pergunta: codigo ? 'Qual material?' : 'Quanto é dois mais dois?' });
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(retry.body.ja_existia, true); assert.equal(retry.body.mensagem_retorno, answer.body.resposta);
    const recovered = await request(app).post('/internal/conversas').set(serviceAuth)
      .send({ chave_chamada: chave, versao_chave: 'test' });
    assert.equal(recovered.body.agente_id, codigo ? agentes[0] : null);
  }
  // Publicar outro agente substitui o anterior, preservando a conversa já aberta.
  const another = await prisma.campanha.create({ data: { nome: 'Novo tutor', escolaId: escolas[0].id, usaRag: true, ativa: false } });
  agentes.push(another.id);
  await prisma.documento.create({ data: { campanhaId: another.id, nomeOriginal: 'teste.txt', mimeType: 'text/plain',
    caminhoArquivo: '/tmp/integration-placeholder', statusIndexacao: 'PRONTO' } });
  assert.equal((await request(app).patch(`/campanhas/${another.id}`).set(authA).send({ ativa: true })).status, 200);
  assert.equal(await prisma.campanha.count({ where: { escolaId: escolas[0].id, ativa: true } }), 1);
  assert.equal((await prisma.conversa.findUnique({ where: { id: conversas[1] } })).agenteId, agentes[0]);
  console.log('Integração aprovada: migrações, upload, pgvector, isolamento A/B, publicação única, voz/painel e recuperação da conversa.');
} finally {
  await prisma.interacao.deleteMany({ where: { conversa_id: { in: conversas } } });
  await prisma.conversa.deleteMany({ where: { id: { in: conversas } } });
  await prisma.documento.deleteMany({ where: { campanhaId: { in: agentes } } });
  await prisma.campanha.deleteMany({ where: { id: { in: agentes } } });
  await prisma.escola.deleteMany({ where: { id: { in: escolas.map((e) => e.id) } } });
  for (const path of arquivos) await fs.unlink(path).catch(() => {});
  await prisma.$disconnect();
}
