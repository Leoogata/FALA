// tests/voice.test.js — Testes do ciclo de voz com memória de conversa
'use strict';

process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'authtest';
process.env.BACKEND_API_URL = 'http://localhost:9999';
process.env.WATSONX_API_KEY = 'test-key';
process.env.WATSONX_PROJECT_ID = 'test-project';
process.env.WATSONX_AGENT_ORCHESTRATOR_ID = 'orch-agent-id';
process.env.WATSONX_AGENT_ID_HISTORIA = 'agent-historia';
process.env.WATSONX_AGENT_ID_GEOGRAFIA = 'agent-geografia';
process.env.WATSONX_AGENT_ID_PORTUGUES = 'agent-portugues';
process.env.WATSONX_AGENT_ID_MATEMATICA = 'agent-matematica';
process.env.WATSONX_AGENT_ID_CIENCIAS = 'agent-ciencias';
process.env.TWILIO_STT_CONFIDENCE_THRESHOLD = '0.6';
process.env.VOICE_MAX_RETRIES = '2';
process.env.ORCHESTRATOR_CONFIDENCE_THRESHOLD = '0.5';
process.env.HMAC_SECRET = 'segredo-de-teste-que-tem-pelo-menos-32-caracteres';
process.env.HMAC_SECRET_VERSION = 'v1';
process.env.INTERNAL_API_KEY = 'chave-interna-de-teste-com-32-chars-ok';

const request = require('supertest');
const app = require('../src/app');
const orchestrator = require('../src/services/orchestrator');
const agentEducational = require('../src/services/agentEducational');
const campanhas = require('../src/services/campanhas');
const conversaClient = require('../src/services/conversaClient');
const analytics = require('../src/services/analytics');
const tts = require('../src/services/tts');

jest.mock('../src/services/orchestrator');
jest.mock('../src/services/agentEducational');
jest.mock('../src/services/campanhas');
jest.mock('../src/services/conversaClient');
jest.mock('../src/services/analytics');
jest.mock('../src/services/tts', () => ({
  textoParaAudioUrl: jest.fn(),
  consumirAudio: jest.fn(),
  // urlMensagemFixa retorna null por padrão nos testes — sem cache pré-aquecido
  urlMensagemFixa: jest.fn().mockReturnValue(null),
  preAquecer: jest.fn().mockResolvedValue(undefined),
}));

const CAMPANHAS_MOCK = [
  { id: 'cm-hist', campanhaId: 'historia', nome: 'História', descricao: 'Eventos históricos.' },
  { id: 'cm-geo', campanhaId: 'geografia', nome: 'Geografia', descricao: 'Geografia mundial.' },
  { id: 'cm-port', campanhaId: 'portugues', nome: 'Português', descricao: 'Gramática e literatura.' },
  { id: 'cm-mat', campanhaId: 'matematica', nome: 'Matemática', descricao: 'Cálculo e álgebra.' },
  { id: 'cm-cie', campanhaId: 'ciencias', nome: 'Ciências', descricao: 'Biologia e física.' },
];

const CONVERSA_MOCK = { conversa_id: 'uuid-conversa-1', estado: 'ATIVA' };
const TURNO_MOCK = { interacao_id: 'uuid-interacao-1', ordem: 1, status: 'RECEBIDO', ja_existia: false };

beforeEach(() => {
  jest.clearAllMocks();
  campanhas.getCampanhasAtivas.mockResolvedValue(CAMPANHAS_MOCK);
  conversaClient.criarOuRecuperarConversa.mockResolvedValue(CONVERSA_MOCK);
  conversaClient.reservarTurno.mockResolvedValue(TURNO_MOCK);
  conversaClient.buscarContexto.mockResolvedValue([]);
  conversaClient.concluirTurno.mockResolvedValue({ id: 'uuid-interacao-1', status: 'RESPONDIDO' });
  conversaClient.encerrarConversa.mockResolvedValue();
  analytics.registrarInteracao.mockImplementation(() => {});
  // Por padrão o TTS retorna null → fallback para Polly (não afeta os demais testes)
  tts.textoParaAudioUrl.mockResolvedValue(null);
});

// ──────────────────────────────────────────────────────────
// POST /voice/incoming
// ──────────────────────────────────────────────────────────

describe('POST /voice/incoming', () => {
  it('deve criar conversa e retornar TwiML com <Gather input="speech"> e Say de boas-vindas', async () => {
    const res = await request(app)
      .post('/voice/incoming')
      .type('form')
      .send({ CallSid: 'CA001', From: '+5511912345678', To: '+5511900000000', CallStatus: 'ringing' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/xml/);
    expect(res.text).toContain('<Gather');
    expect(res.text).toContain('input="speech"');
    expect(res.text).toContain('/voice/turn');
    expect(conversaClient.criarOuRecuperarConversa).toHaveBeenCalledOnce
      ? expect(conversaClient.criarOuRecuperarConversa).toHaveBeenCalledOnce()
      : expect(conversaClient.criarOuRecuperarConversa).toHaveBeenCalledTimes(1);
  });

  it('deve rejeitar requisição sem CallSid', async () => {
    const res = await request(app)
      .post('/voice/incoming')
      .type('form')
      .send({ From: '+5511912345678' });

    expect(res.status).toBe(400);
    expect(conversaClient.criarOuRecuperarConversa).not.toHaveBeenCalled();
  });

  it('deve retornar indisponibilidade se o banco falhar', async () => {
    conversaClient.criarOuRecuperarConversa.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/voice/incoming')
      .type('form')
      .send({ CallSid: 'CA-fail', CallStatus: 'ringing' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
    expect(res.text).toContain('temporariamente indispon');
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — ausência de fala
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — ausência de fala', () => {
  it('deve incrementar tentativas e pedir repetição quando SpeechResult está ausente', async () => {
    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA002', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Gather');
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
  });

  it('não deve apagar a sessão de conversa ao falhar STT', async () => {
    // Primeira tentativa falha STT — conversa continua
    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA002-stt', CallStatus: 'in-progress' });

    // Reserva de turno não deve ser chamada para falhas STT
    expect(conversaClient.reservarTurno).not.toHaveBeenCalled();
  });

  it('deve encerrar a chamada após atingir VOICE_MAX_RETRIES tentativas', async () => {
    const payload = { CallSid: 'CA003', CallStatus: 'in-progress' };

    // Primeira tentativa
    await request(app).post('/voice/turn').type('form').send(payload);
    // Segunda tentativa → deve encerrar
    const res = await request(app).post('/voice/turn').type('form').send(payload);

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — encerramento por tecla
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — encerramento por tecla', () => {
  it('deve encerrar quando aluno pressiona tecla sem fala', async () => {
    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA005', Digits: '1', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — banco indisponível
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — banco indisponível', () => {
  it('deve retornar indisponibilidade e não chamar agentes se reserva falhar', async () => {
    conversaClient.reservarTurno.mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-db-fail', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
  });

  it('deve retornar indisponibilidade se leitura de contexto falhar', async () => {
    conversaClient.buscarContexto.mockRejectedValue(new Error('Context read failed'));

    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-ctx-fail', SpeechResult: 'Dom Pedro?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
  });

  it('deve retornar indisponibilidade se gravação de sem_rota falhar', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: true,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    conversaClient.concluirTurno.mockRejectedValue(new Error('DB write fail'));

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-sem-rota-fail', SpeechResult: 'Pergunta sem rota', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
  });

  it('deve retornar indisponibilidade se gravação da resposta final falhar', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Dom Pedro I proclamou a independência.', confianca: 0.9,
      sem_resposta: false, precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    conversaClient.concluirTurno.mockRejectedValue(new Error('DB write fail'));

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-resp-fail', SpeechResult: 'Quem proclamou a independência?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Hangup');
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — roteamento com histórico
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — roteamento para cada matéria com histórico', () => {
  const materias = ['historia', 'geografia', 'portugues', 'matematica', 'ciencias'];

  materias.forEach((campanhaId) => {
    it(`deve rotear corretamente para '${campanhaId}' passando histórico ao orquestrador`, async () => {
      const historico = [{ pergunta: 'Pergunta anterior', resposta: 'Resposta anterior', materia: campanhaId, status: 'RESPONDIDO' }];
      conversaClient.buscarContexto.mockResolvedValue(historico);

      orchestrator.routeQuestion.mockResolvedValue({
        campanhaId, confianca: 0.9, sem_rota: false,
        precisa_esclarecimento: false, pergunta_esclarecimento: '',
      });
      agentEducational.answerQuestion.mockResolvedValue({
        resposta: '', confianca: 0, sem_resposta: true,
        precisa_esclarecimento: false, pergunta_esclarecimento: '',
      });

      const res = await request(app)
        .post('/voice/turn')
        .type('form')
        .send({ CallSid: `CA-${campanhaId}`, SpeechResult: 'Uma dúvida escolar', Confidence: '0.85', CallStatus: 'in-progress' });

      expect(res.status).toBe(200);
      expect(orchestrator.routeQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ pergunta: 'Uma dúvida escolar', historico })
      );
      expect(agentEducational.answerQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ campanhaId, historico })
      );
    });
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — pergunta ambígua (sem_rota: true)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — pergunta ambígua / sem rota', () => {
  it('deve retornar TwiML pedindo reformulação e não chamar subagente', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.3, sem_rota: true,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA006', SpeechResult: 'Quero aprender mais', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Gather');
    expect(agentEducational.answerQuestion).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — esclarecimento pelo orquestrador
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — esclarecimento pelo orquestrador', () => {
  it('deve retornar pergunta de esclarecimento e não chamar subagente', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.7, sem_rota: true,
      precisa_esclarecimento: true, pergunta_esclarecimento: 'Você está falando de qual personagem histórico?',
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-escl-orch', SpeechResult: 'Como foi a eleição dele?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('personagem hist');
    expect(res.text).toContain('<Say');
    expect(agentEducational.answerQuestion).not.toHaveBeenCalled();
    // Deve persistir como ESCLARECIMENTO
    expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ESCLARECIMENTO' })
    );
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — esclarecimento pelo subagente
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — esclarecimento pelo subagente', () => {
  it('deve retornar pergunta de esclarecimento do subagente em voz', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: '', confianca: 0, sem_resposta: true,
      precisa_esclarecimento: true, pergunta_esclarecimento: 'Você quer saber sobre qual presidente?',
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-escl-agent', SpeechResult: 'Como foi a eleição dele?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('qual presidente');
    expect(res.text).toContain('<Say');
    expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ESCLARECIMENTO', sem_resposta: true })
    );
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — caminho feliz (resposta disponível)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — caminho feliz', () => {
  it('deve retornar a resposta do subagente no TwiML <Say>', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'ciencias', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
  it('deve retornar a resposta do subagente no TwiML <Say> (fallback Polly)', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'ciencias', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese é o processo pelo qual as plantas produzem energia a partir da luz solar.',
      confianca: 0.85,
      sem_resposta: false,
      precisa_esclarecimento: false,
      pergunta_esclarecimento: '',
    });
    tts.textoParaAudioUrl.mockResolvedValue(null); // sem ElevenLabs → Polly

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA007', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Fotossíntese');
    expect(res.text).toContain('<Say');
    expect(res.text).not.toContain('<Play'); // fallback Polly: sem Play
  });

  it('deve usar <Play> quando ElevenLabs retorna URL de áudio', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'ciencias', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese é o processo pelo qual as plantas produzem energia.',
      confianca: 0.85,
      sem_resposta: false,
    });
    tts.textoParaAudioUrl.mockResolvedValue('https://mcs.us1.twilio.com/v1/Services/AC.../audio.mp3');

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA007b', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Play');
    expect(res.text).toContain('mcs.us1.twilio.com');
    // Quando há Play, o texto da resposta NÃO aparece no XML (está no áudio)
    expect(res.text).not.toContain('Fotossíntese');
  });

  it('deve confirmar a gravação no banco antes de retornar resposta', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'ciencias', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese é o processo pelo qual as plantas produzem energia.',
      confianca: 0.85,
      sem_resposta: false,
      precisa_esclarecimento: false,
      pergunta_esclarecimento: '',
    });

    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA008', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
      expect.objectContaining({
        conversa_id: 'uuid-conversa-1',
        materia: 'ciencias',
        campanha_id: 'cm-cie',
        sem_resposta: false,
        status: 'RESPONDIDO',
      })
    );
  });

  it('deve incluir historico na chamada ao orquestrador e subagente', async () => {
    const historico = [
      { pergunta: 'Quem foi Dom Pedro I?', resposta: 'Foi o primeiro imperador do Brasil.', materia: 'historia', status: 'RESPONDIDO' },
    ];
    conversaClient.buscarContexto.mockResolvedValue(historico);

    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Tancredo Neves foi eleito de forma indireta pelo Colégio Eleitoral.',
      confianca: 0.88,
      sem_resposta: false,
      precisa_esclarecimento: false,
      pergunta_esclarecimento: '',
    });

    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-hist-2', SpeechResult: 'Como foi sua eleição?', Confidence: '0.9' });

    expect(orchestrator.routeQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ historico })
    );
    expect(agentEducational.answerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ historico })
    );
  });

  it('deve incluir o turno_token na URL de action do próximo Gather', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'ciencias', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese.',
      confianca: 0.85, sem_resposta: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-token', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9' });

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/turno_token=[0-9a-f-]{36}/);
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — fallback sem_resposta: true
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — fallback sem_resposta', () => {
  it('deve retornar áudio de fallback quando subagente retorna sem_resposta: true', async () => {
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'historia', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: '', confianca: 0, sem_resposta: true,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
  it('deve retornar mensagem de fallback via <Say> quando ElevenLabs indisponível', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'historia', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });
    tts.textoParaAudioUrl.mockResolvedValue(null);

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA009', SpeechResult: 'Quem foi Dom Pedro I?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('professor');
    expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SEM_RESPOSTA', sem_resposta: true })
    );
    expect(res.text).not.toContain('<Play');
  });

  it('deve usar <Play> para a mensagem de fallback quando ElevenLabs disponível', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'historia', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });
    tts.textoParaAudioUrl.mockResolvedValue('https://mcs.us1.twilio.com/v1/Services/AC.../fallback.mp3');

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA009b', SpeechResult: 'Quem foi Dom Pedro I?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Play');
    expect(res.text).toContain('fallback.mp3');
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — idempotência de token (turno já existente)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — idempotência', () => {
  it('deve reutilizar resultado salvo quando turno_token já foi processado (sem mensagem_retorno)', async () => {
    conversaClient.reservarTurno.mockResolvedValue({
      interacao_id: 'uuid-existente', ordem: 2, status: 'RESPONDIDO',
      mensagem_retorno: null, concluida_em: new Date().toISOString(), ja_existia: true,
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-idem', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', turno_token: 'abc-token' });

    expect(res.status).toBe(200);
    // Não deve chamar orquestrador nem subagente
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
    expect(agentEducational.answerQuestion).not.toHaveBeenCalled();
    // Não deve chamar concluirTurno novamente
    expect(conversaClient.concluirTurno).not.toHaveBeenCalled();
    // Retorna TwiML de fallback (sem mensagem salva)
    expect(res.text).toContain('<Say');
  });

  it('deve reproduzir mensagem_retorno salva no TwiML quando turno já foi concluído', async () => {
    conversaClient.reservarTurno.mockResolvedValue({
      interacao_id: 'uuid-existente', ordem: 2, status: 'RESPONDIDO',
      mensagem_retorno: 'A fotossíntese é o processo pelo qual plantas produzem energia.',
      concluida_em: new Date().toISOString(), ja_existia: true,
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-idem2', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', turno_token: 'abc-token-2' });

    expect(res.status).toBe(200);
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
    expect(conversaClient.concluirTurno).not.toHaveBeenCalled();
    // Deve reproduzir a mensagem salva no TwiML
    expect(res.text).toContain('A fotossíntese é o processo pelo qual plantas produzem energia.');
  });

  it('deve retornar indisponibilidade quando turno existe mas ainda está em processamento', async () => {
    conversaClient.reservarTurno.mockResolvedValue({
      interacao_id: 'uuid-existente', ordem: 2, status: 'RECEBIDO',
      mensagem_retorno: null, concluida_em: null, ja_existia: true,
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-proc', SpeechResult: 'Pergunta em processamento', Confidence: '0.9', turno_token: 'abc-token-3' });

    expect(res.status).toBe(200);
    expect(orchestrator.routeQuestion).not.toHaveBeenCalled();
    expect(conversaClient.concluirTurno).not.toHaveBeenCalled();
    // Deve retornar TwiML de indisponibilidade
    expect(res.text).toContain('<Hangup');
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — use campanha_id real (não campanhaId)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — ID real da campanha no banco', () => {
  it('deve usar o id real da campanha (cm-port) e a materia (portugues) separadamente', async () => {
    campanhas.getCampanhasAtivas.mockResolvedValue([
      { id: 'cm-port', campanhaId: 'portugues', nome: 'Português' },
    ]);
    orchestrator.routeQuestion.mockResolvedValue({
      campanhaId: 'portugues', confianca: 0.9, sem_rota: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'O predicado é...', confianca: 0.9, sem_resposta: false,
      precisa_esclarecimento: false, pergunta_esclarecimento: '',
    });

    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA-camp-id', SpeechResult: 'O que é predicado?', Confidence: '0.99' });

    expect(agentEducational.answerQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ campanhaId: 'portugues' })
    );
    expect(conversaClient.concluirTurno).toHaveBeenCalledWith(
      expect.objectContaining({ campanha_id: 'cm-port', materia: 'portugues' })
    );
  });
});
