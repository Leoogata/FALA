// tests/analytics-materias.test.js — Testes da rota GET /analytics/materias
// e da lógica de agregarMateriasPorEscola.

// Configurar token de escola antes de importar o app (setup-env.cjs não inclui SCHOOL_API_TOKENS)
const ESCOLA_CODIGO = '1234';
const TOKEN = 'test-school-token-analytics-ok-padded-32chars';
process.env.SCHOOL_API_TOKENS = JSON.stringify({ [ESCOLA_CODIGO]: TOKEN });

import { jest } from '@jest/globals';
import request from 'supertest';

// ─── Mocks de dependências externas ──────────────────────────────────────────

const mockMateriasPorEscola = jest.fn();

jest.unstable_mockModule('../src/repositories/analytics.repository.js', () => ({
  analyticsRepository: {
    resumo: jest.fn(),
    topPerguntas: jest.fn(),
    volumePorDia: jest.fn(),
  },
  materiasPorEscola: mockMateriasPorEscola,
}));

// Mock do Prisma para schoolAuth (busca escola por código)
const mockPrisma = {
  escola: { findUnique: jest.fn() },
};
jest.unstable_mockModule('../src/config/prisma.js', () => ({ default: mockPrisma }));

const { default: app } = await import('../src/app.js');

const ESCOLA_ID = 'escola-abc-123';

// schoolAuth injeta req.escola via prisma.escola.findUnique
beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.escola.findUnique.mockResolvedValue({ id: ESCOLA_ID, codigo: ESCOLA_CODIGO, nome: 'Escola Teste' });
});

// Resposta padrão do repositório
const RAW_PADRAO = {
  total: 100,
  classificadas: 85,
  indeterminadas: 13,
  falhasClassificacao: 2,
  materias: [
    { materia: 'matematica', total: 32 },
    { materia: 'ciencias',   total: 20 },
    { materia: 'portugues',  total: 15 },
    { materia: 'historia',   total: 11 },
    { materia: 'geografia',  total:  7 },
  ],
};

function authHeader() {
  return { Authorization: `Bearer ${TOKEN}` };
}

// ─── agregarMateriasPorEscola (serviço) ───────────────────────────────────────

const { agregarMateriasPorEscola } = await import('../src/services/analytics.service.js');

describe('agregarMateriasPorEscola', () => {
  beforeEach(() => {
    mockMateriasPorEscola.mockResolvedValue(RAW_PADRAO);
  });

  it('retorna as cinco matérias incluindo as com zero', async () => {
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    expect(resultado.materias).toHaveLength(5);
    const nomes = resultado.materias.map((m) => m.materia);
    expect(nomes).toContain('ciencias');
    expect(nomes).toContain('historia');
    expect(nomes).toContain('matematica');
    expect(nomes).toContain('portugues');
    expect(nomes).toContain('geografia');
  });

  it('ordena por contagem decrescente', async () => {
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    const totais = resultado.materias.map((m) => m.total);
    for (let i = 1; i < totais.length; i++) {
      expect(totais[i - 1]).toBeGreaterThanOrEqual(totais[i]);
    }
  });

  it('calcula coberturaPercentual corretamente', async () => {
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    // 85 / 100 = 85%
    expect(resultado.coberturaPercentual).toBe(85);
  });

  it('total = classificadas + indeterminadas + falhasClassificacao', async () => {
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    expect(resultado.total).toBe(
      resultado.classificadas + resultado.indeterminadas + resultado.falhasClassificacao,
    );
  });

  it('retorna zeros quando total=0', async () => {
    mockMateriasPorEscola.mockResolvedValue({
      total: 0, classificadas: 0, indeterminadas: 0, falhasClassificacao: 0, materias: [],
    });
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    expect(resultado.total).toBe(0);
    expect(resultado.coberturaPercentual).toBe(0);
    expect(resultado.materias.every((m) => m.total === 0)).toBe(true);
    expect(resultado.materias.every((m) => m.percentual === 0)).toBe(true);
    expect(resultado.materias).toHaveLength(5);
  });

  it('inclui periodo com inicio e fim em ISO', async () => {
    const resultado = await agregarMateriasPorEscola(ESCOLA_ID, { dias: 7 });
    expect(resultado.periodo.dias).toBe(7);
    expect(new Date(resultado.periodo.inicio)).toBeInstanceOf(Date);
    expect(new Date(resultado.periodo.fim)).toBeInstanceOf(Date);
  });

  it('usa dias=7 como padrão', async () => {
    await agregarMateriasPorEscola(ESCOLA_ID);
    expect(mockMateriasPorEscola).toHaveBeenCalledWith(
      ESCOLA_ID,
      expect.any(Date),
      expect.any(Date),
    );
  });
});

// ─── GET /analytics/materias (HTTP) ──────────────────────────────────────────

describe('GET /analytics/materias', () => {
  beforeEach(() => {
    mockMateriasPorEscola.mockResolvedValue(RAW_PADRAO);
  });

  it('retorna 401 sem credencial', async () => {
    const res = await request(app).get('/analytics/materias');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com credencial válida e estrutura correta', async () => {
    const res = await request(app).get('/analytics/materias').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('materias');
    expect(res.body.materias).toHaveLength(5);
    expect(res.body).toHaveProperty('periodo');
    expect(res.body).toHaveProperty('coberturaPercentual');
    expect(res.body).toHaveProperty('indeterminadas');
    expect(res.body).toHaveProperty('falhasClassificacao');
  });

  it('aplica Cache-Control: private, no-store', async () => {
    const res = await request(app).get('/analytics/materias').set(authHeader());
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('retorna 400 para dias=0 (fora do intervalo)', async () => {
    const res = await request(app).get('/analytics/materias?dias=0').set(authHeader());
    expect(res.status).toBe(400);
  });

  it('retorna 400 para dias=8 (fora do intervalo)', async () => {
    const res = await request(app).get('/analytics/materias?dias=8').set(authHeader());
    expect(res.status).toBe(400);
  });

  it('aceita dias=1 (últimas 24h)', async () => {
    const res = await request(app).get('/analytics/materias?dias=1').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.periodo.dias).toBe(1);
  });

  it('usa dias=7 por padrão', async () => {
    const res = await request(app).get('/analytics/materias').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.periodo.dias).toBe(7);
  });

  it('não inclui transcrições ou identificadores de alunos', async () => {
    const res = await request(app).get('/analytics/materias').set(authHeader());
    const body = res.body;
    expect(body).not.toHaveProperty('pergunta');
    expect(body).not.toHaveProperty('resposta');
    expect(body).not.toHaveProperty('call_sid');
    expect(body).not.toHaveProperty('aluno_id');
    expect(body).not.toHaveProperty('turno_token');
  });
});
