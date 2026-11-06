process.env.HMAC_SECRET = 'segredo-de-teste-que-tem-pelo-menos-32-chars';
process.env.BACKEND_API_URL = 'http://backend.test';
jest.mock('../src/services/agentEducational');
jest.mock('../src/services/conversaClient');
jest.mock('../src/services/tts', () => ({ textoParaAudioUrl: jest.fn().mockResolvedValue(null), urlMensagemFixa: jest.fn() }));
const agent = require('../src/services/agentEducational');
const client = require('../src/services/conversaClient');
const turnHandler = require('../src/handlers/turnHandler');
beforeEach(() => {
  jest.clearAllMocks();
  client.criarOuRecuperarConversa.mockResolvedValue({ conversa_id: 'c1', estado: 'ATIVA' });
  client.reservarTurno.mockResolvedValue({ interacao_id: 'i1', status: 'RECEBIDO', ja_existia: false });
  client.concluirTurno.mockResolvedValue({});
});
test.each([null, 'agente-escola-1'])('persiste o ID do agente escolhido no backend: %s', async (id) => {
  agent.answerQuestion.mockResolvedValue({ resposta: 'Predicado...', confianca: 0.9, sem_resposta: false,
    campanha_id: id, fontes: [], versao_prompt: 'v1' });
  const res = { type: jest.fn().mockReturnThis(), send: jest.fn() };
  await turnHandler({ body: { CallSid: `CA-${id}`, SpeechResult: 'O que é predicado?', Confidence: '0.99' }, query: {} }, res);
  expect(client.concluirTurno).toHaveBeenCalledWith(expect.objectContaining({ campanha_id: id, materia: null,
    fontes: [], versao_prompt: 'v1', status: 'RESPONDIDO' }));
  expect(agent.answerQuestion).toHaveBeenCalledTimes(1);
});
