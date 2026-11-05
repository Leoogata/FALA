'use strict';

process.env.HMAC_SECRET = 'segredo-de-teste-que-tem-pelo-menos-32-chars';
process.env.HMAC_SECRET_VERSION = 'v1';
process.env.INTERNAL_API_KEY = 'chave-interna-de-teste-com-32-chars-ok';
process.env.BACKEND_API_URL = 'http://backend.test';

jest.mock('../src/services/campanhas');
jest.mock('../src/services/orchestrator');
jest.mock('../src/services/agentEducational');
jest.mock('../src/services/conversaClient');

const campanhas = require('../src/services/campanhas');
const orchestrator = require('../src/services/orchestrator');
const agent = require('../src/services/agentEducational');
const conversaClient = require('../src/services/conversaClient');
const turnHandler = require('../src/handlers/turnHandler');

beforeEach(() => {
  jest.clearAllMocks();
  conversaClient.criarOuRecuperarConversa.mockResolvedValue({ conversa_id: 'uuid-conv-test', estado: 'ATIVA' });
  conversaClient.reservarTurno.mockResolvedValue({ interacao_id: 'uuid-int-test', ordem: 1, status: 'RECEBIDO', ja_existia: false });
  conversaClient.buscarContexto.mockResolvedValue([]);
  conversaClient.concluirTurno.mockResolvedValue({ id: 'uuid-int-test', status: 'RESPONDIDO' });
  conversaClient.encerrarConversa.mockResolvedValue();
});

test('usa a matéria no subagente e o ID real da campanha no banco', async () => {
  campanhas.getCampanhasAtivas.mockResolvedValue([{ id: 'cm123', campanhaId: 'portugues', nome: 'Português' }]);
  orchestrator.routeQuestion.mockResolvedValue({
    campanhaId: 'portugues', confianca: 0.9, sem_rota: false,
    precisa_esclarecimento: false, pergunta_esclarecimento: '',
  });
  agent.answerQuestion.mockResolvedValue({
    resposta: 'Predicado...', confianca: 0.9, sem_resposta: false,
    precisa_esclarecimento: false, pergunta_esclarecimento: '',
  });

  const res = { type: jest.fn().mockReturnThis(), send: jest.fn() };
  await turnHandler({ body: { CallSid: 'CA-test', SpeechResult: 'O que é predicado?', Confidence: '0.99' }, query: {} }, res);

  expect(agent.answerQuestion).toHaveBeenCalledWith(
    expect.objectContaining({ campanhaId: 'portugues', pergunta: 'O que é predicado?' })
  );
  expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
    expect.objectContaining({ campanha_id: 'cm123', materia: 'portugues' })
  );
  expect(res.send).toHaveBeenCalled();
});

test('não chama subagente quando precisa_esclarecimento=true no orquestrador', async () => {
  campanhas.getCampanhasAtivas.mockResolvedValue([{ id: 'cm-hist', campanhaId: 'historia', nome: 'História' }]);
  orchestrator.routeQuestion.mockResolvedValue({
    campanhaId: 'historia', confianca: 0.7, sem_rota: true,
    precisa_esclarecimento: true, pergunta_esclarecimento: 'De quem você está falando?',
  });

  const res = { type: jest.fn().mockReturnThis(), send: jest.fn() };
  await turnHandler({ body: { CallSid: 'CA-escl', SpeechResult: 'Como foi a eleição dele?', Confidence: '0.9' }, query: {} }, res);

  expect(agent.answerQuestion).not.toHaveBeenCalled();
  expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'ESCLARECIMENTO' })
  );
  expect(res.send).toHaveBeenCalled();
});
