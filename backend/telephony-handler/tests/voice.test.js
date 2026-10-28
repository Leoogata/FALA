// tests/voice.test.js — Testes do ciclo de voz
'use strict';

process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'authtest';
process.env.BACKEND_API_URL = 'http://localhost:9999';
process.env.ANALYTICS_SERVICE_URL = 'http://localhost:9998';
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

const request = require('supertest');
const app = require('../src/app');
const orchestrator = require('../src/services/orchestrator');
const agentEducational = require('../src/services/agentEducational');
const campanhas = require('../src/services/campanhas');
const analytics = require('../src/services/analytics');

jest.mock('../src/services/orchestrator');
jest.mock('../src/services/agentEducational');
jest.mock('../src/services/campanhas');
jest.mock('../src/services/analytics');

const CAMPANHAS_MOCK = [
  { campanhaId: 'historia', nome: 'História', descricao: 'Eventos históricos.' },
  { campanhaId: 'geografia', nome: 'Geografia', descricao: 'Geografia mundial.' },
  { campanhaId: 'portugues', nome: 'Português', descricao: 'Gramática e literatura.' },
  { campanhaId: 'matematica', nome: 'Matemática', descricao: 'Cálculo e álgebra.' },
  { campanhaId: 'ciencias', nome: 'Ciências', descricao: 'Biologia e física.' },
];

beforeEach(() => {
  jest.clearAllMocks();
  campanhas.getCampanhasAtivas.mockResolvedValue(CAMPANHAS_MOCK);
  analytics.registrarInteracao.mockImplementation(() => {});
});

// ──────────────────────────────────────────────────────────
// POST /voice/incoming
// ──────────────────────────────────────────────────────────

describe('POST /voice/incoming', () => {
  it('deve retornar TwiML com <Gather input="speech"> e Say de boas-vindas', async () => {
    const res = await request(app)
      .post('/voice/incoming')
      .type('form')
      .send({ CallSid: 'CA001', From: '+5511912345678', To: '+5511900000000', CallStatus: 'ringing' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/xml/);
    expect(res.text).toContain('<Gather');
    expect(res.text).toContain('input="speech"');
    expect(res.text).toContain('/voice/turn');
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
// POST /voice/turn — baixa confiança STT
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — baixa confiança STT', () => {
  it('deve pedir repetição quando Confidence está abaixo do threshold', async () => {
    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA004', SpeechResult: 'algo', Confidence: '0.3', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('<Gather');
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
// POST /voice/turn — roteamento bem-sucedido
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — roteamento para cada matéria', () => {
  const materias = ['historia', 'geografia', 'portugues', 'matematica', 'ciencias'];

  materias.forEach((campanhaId) => {
    it(`deve rotear corretamente para '${campanhaId}' e chamar o subagente`, async () => {
      orchestrator.routeQuestion.mockResolvedValue({ campanhaId, confianca: 0.9, sem_rota: false });
      agentEducational.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });

      const res = await request(app)
        .post('/voice/turn')
        .type('form')
        .send({ CallSid: `CA-${campanhaId}`, SpeechResult: 'Uma dúvida escolar', Confidence: '0.85', CallStatus: 'in-progress' });

      expect(res.status).toBe(200);
      expect(orchestrator.routeQuestion).toHaveBeenCalledWith(
        expect.objectContaining({ pergunta: 'Uma dúvida escolar' })
      );
      expect(agentEducational.answerQuestion).toHaveBeenCalledWith({ campanhaId, pergunta: 'Uma dúvida escolar' });
    });
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — pergunta ambígua (sem_rota: true)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — pergunta ambígua / sem rota', () => {
  it('deve retornar TwiML pedindo reformulação e não chamar subagente', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: null, confianca: 0.3, sem_rota: true });

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
// POST /voice/turn — caminho feliz (resposta disponível)
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — caminho feliz', () => {
  it('deve retornar a resposta do subagente no TwiML <Say>', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'ciencias', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese é o processo pelo qual as plantas produzem energia a partir da luz solar.',
      confianca: 0.85,
      sem_resposta: false,
    });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA007', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Fotossíntese');
    expect(res.text).toContain('<Say');
  });

  it('deve registrar a interação no analytics após cada turno', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'ciencias', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({
      resposta: 'Fotossíntese é o processo pelo qual as plantas produzem energia.',
      confianca: 0.85,
      sem_resposta: false,
    });

    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA008', SpeechResult: 'O que é fotossíntese?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(analytics.registrarInteracao).toHaveBeenCalledWith(
      expect.objectContaining({
        campanha_id: 'ciencias',
        pergunta: 'O que é fotossíntese?',
        sem_resposta: false,
        call_sid: 'CA008',
      })
    );
  });
});

// ──────────────────────────────────────────────────────────
// POST /voice/turn — fallback sem_resposta: true
// ──────────────────────────────────────────────────────────

describe('POST /voice/turn — fallback sem_resposta', () => {
  it('deve retornar áudio de fallback quando subagente retorna sem_resposta: true', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'historia', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });

    const res = await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA009', SpeechResult: 'Quem foi Dom Pedro I?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(res.status).toBe(200);
    // A mensagem de fallback deve estar no Say
    expect(res.text).toContain('professor');
  });

  it('deve registrar interação com sem_resposta: true no analytics', async () => {
    orchestrator.routeQuestion.mockResolvedValue({ campanhaId: 'historia', confianca: 0.9, sem_rota: false });
    agentEducational.answerQuestion.mockResolvedValue({ resposta: '', confianca: 0, sem_resposta: true });

    await request(app)
      .post('/voice/turn')
      .type('form')
      .send({ CallSid: 'CA010', SpeechResult: 'Quem foi Dom Pedro I?', Confidence: '0.9', CallStatus: 'in-progress' });

    expect(analytics.registrarInteracao).toHaveBeenCalledWith(
      expect.objectContaining({ sem_resposta: true, call_sid: 'CA010' })
    );
  });
});
