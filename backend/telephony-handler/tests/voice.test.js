process.env.NODE_ENV = 'test';
process.env.HMAC_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';
process.env.INTERNAL_API_KEY = 'test-internal-key-at-least-32-characters';
process.env.BACKEND_API_URL = 'http://backend.test';
const request = require('supertest');
jest.mock('../src/services/agentEducational');
jest.mock('../src/services/conversaClient');
jest.mock('../src/services/campanhas');
jest.mock('../src/services/tts', () => ({ textoParaAudioUrl: jest.fn(), urlMensagemFixa: jest.fn().mockReturnValue(null), consumirAudio: jest.fn() }));
const app = require('../src/app');
const agent = require('../src/services/agentEducational');
const client = require('../src/services/conversaClient');
const campanhas = require('../src/services/campanhas');
const session = require('../src/services/callSession');
const tts = require('../src/services/tts');
let serial = 0;
const post = (body = {}) => request(app).post('/voice/turn').type('form').send({
  CallSid: `CA-test-${++serial}`, SpeechResult: 'Como funciona a fotossíntese?', Confidence: '0.99', ...body,
});
beforeEach(() => {
  jest.resetAllMocks();
  client.criarOuRecuperarConversa.mockResolvedValue({ conversa_id: 'c1', estado: 'ATIVA' });
  client.reservarTurno.mockResolvedValue({ interacao_id: 'i1', status: 'RECEBIDO', ja_existia: false });
  client.concluirTurno.mockResolvedValue({});
  tts.textoParaAudioUrl.mockResolvedValue(null);
  agent.answerQuestion.mockResolvedValue({ resposta: 'As plantas usam a luz para produzir alimento.', confianca: 0.9,
    sem_resposta: false, precisa_esclarecimento: false, pergunta_esclarecimento: '', campanha_id: null, fontes: [] });
});
test('incoming pede código no teclado', async () => {
  const res = await request(app).post('/voice/incoming').type('form').send({ CallSid: 'CA-incoming' });
  expect(res.text).toContain('input="dtmf"'); expect(res.text).toContain('/voice/escola');
});
test('escola válida é enviada ao criar a conversa persistida', async () => {
  campanhas.resolverEscola.mockResolvedValue({ id: 'e1', codigo: '1001', nome: 'Escola A' });
  const res = await request(app).post('/voice/escola').type('form').send({ CallSid: 'CA-escola', Digits: '1001' });
  expect(client.criarOuRecuperarConversa).toHaveBeenCalledWith(expect.objectContaining({ codigoEscola: '1001' }));
  expect(res.text).toContain('Escola A');
});
test('sem código cria conversa geral', async () => {
  await request(app).post('/voice/escola').type('form').send({ CallSid: 'CA-geral' });
  expect(client.criarOuRecuperarConversa).toHaveBeenCalledWith(expect.objectContaining({ codigoEscola: null }));
});
test('código inexistente avisa antes de seguir no geral', async () => {
  campanhas.resolverEscola.mockResolvedValue(null);
  const res = await request(app).post('/voice/escola').type('form').send({ CallSid: 'CA-invalida', Digits: '9999' });
  expect(res.text).toContain('Não encontrei');
});
test('erro ao resolver escola não desvia silenciosamente para o geral', async () => {
  campanhas.resolverEscola.mockRejectedValue(new Error('backend offline'));
  const res = await request(app).post('/voice/escola').type('form').send({ CallSid: 'CA-erro', Digits: '1001' });
  expect(res.text).toContain('<Hangup'); expect(client.criarOuRecuperarConversa).not.toHaveBeenCalled();
});
test('escola sem agente publicado informa indisponibilidade', async () => {
  client.criarOuRecuperarConversa.mockRejectedValue(new Error('sem agente'));
  const res = await request(app).post('/voice/escola').type('form').send({ CallSid: 'CA-sem-agente' });
  expect(res.text).toContain('<Hangup');
});
test('recupera conversa após perda da sessão sem escolher agente por matéria', async () => {
  const res = await post();
  expect(client.criarOuRecuperarConversa).toHaveBeenCalledTimes(1);
  expect(agent.answerQuestion).toHaveBeenCalledWith({ conversaId: 'c1', turnoToken: expect.any(String) });
  expect(res.text).toContain('As plantas'); expect(res.text).toMatch(/turno_token=[0-9a-f-]{36}/);
});
test('STT inválido preserva escola e não chama IA', async () => {
  session.setEscola('CA-stt', '1001');
  await post({ CallSid: 'CA-stt', SpeechResult: '', Confidence: '0' });
  expect(session.getEscola('CA-stt')).toBe('1001'); expect(agent.answerQuestion).not.toHaveBeenCalled();
});
test('encerra após duas falhas STT', async () => {
  await post({ CallSid: 'CA-retry', SpeechResult: '' });
  const res = await post({ CallSid: 'CA-retry', SpeechResult: '' }); expect(res.text).toContain('<Hangup');
});
test('tecla encerra sem chamar IA', async () => {
  const res = await post({ SpeechResult: '', Digits: '1' });
  expect(res.text).toContain('<Hangup'); expect(client.encerrarConversa).toHaveBeenCalledWith('c1');
});
test('falta de CallSid é rejeitada', async () => { expect((await post({ CallSid: '' })).status).toBe(400); });
test('falha ao reservar não chama IA', async () => {
  client.reservarTurno.mockRejectedValue(new Error('db offline'));
  expect((await post()).text).toContain('<Hangup'); expect(agent.answerQuestion).not.toHaveBeenCalled();
});
test('falha de geração ou RAG persiste ERRO', async () => {
  agent.answerQuestion.mockRejectedValue(new Error('rag offline'));
  expect((await post()).text).toContain('<Hangup');
  expect(client.concluirTurno).toHaveBeenCalledWith(expect.objectContaining({ status: 'ERRO' }));
});
test('não devolve resposta se a finalização falhar', async () => {
  client.concluirTurno.mockRejectedValue(new Error('db offline'));
  const res = await post(); expect(res.text).toContain('<Hangup'); expect(res.text).not.toContain('As plantas');
});
test('esclarecimento vem do único agente', async () => {
  agent.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true,
    precisa_esclarecimento: true, pergunta_esclarecimento: 'Qual personagem?', campanha_id: 'a1' });
  expect((await post()).text).toContain('Qual personagem?');
  expect(client.concluirTurno).toHaveBeenCalledWith(expect.objectContaining({ status: 'ESCLARECIMENTO' }));
});
test('sem conteúdo retorna mensagem de apoio', async () => {
  agent.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });
  expect((await post()).text).toContain('professor');
  expect(client.concluirTurno).toHaveBeenCalledWith(expect.objectContaining({ status: 'SEM_RESPOSTA' }));
});
test('usa áudio quando disponível após persistir a resposta', async () => {
  tts.textoParaAudioUrl.mockResolvedValue('https://audio.test/resposta.mp3');
  expect((await post()).text).toContain('<Play>');
  expect(client.concluirTurno.mock.invocationCallOrder[0]).toBeLessThan(tts.textoParaAudioUrl.mock.invocationCallOrder[0]);
});
test.each([null, 'Resposta já salva.'])('retry concluído reproduz resultado sem nova geração: %s', async (mensagem) => {
  client.reservarTurno.mockResolvedValue({ ja_existia: true, status: 'RESPONDIDO', mensagem_retorno: mensagem });
  const res = await post(); expect(res.text).toContain('<Say');
  if (mensagem) expect(res.text).toContain(mensagem);
  expect(agent.answerQuestion).not.toHaveBeenCalled(); expect(client.concluirTurno).not.toHaveBeenCalled();
});
test('retry em processamento não duplica geração', async () => {
  client.reservarTurno.mockResolvedValue({ ja_existia: true, status: 'RECEBIDO' });
  expect((await post()).text).toContain('<Hangup'); expect(agent.answerQuestion).not.toHaveBeenCalled();
});
