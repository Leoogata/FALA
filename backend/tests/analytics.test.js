/**
 * Testes unitários — analyticsService
 *
 * Mocka o analyticsRepository para testar a orquestração
 * e a formatação da resposta sem banco de dados.
 */

import { jest } from '@jest/globals';

const mockRepo = {
  resumo: jest.fn(),
  topPerguntas: jest.fn(),
  volumePorDia: jest.fn(),
};

jest.unstable_mockModule('../src/repositories/analytics.repository.js', () => ({
  analyticsRepository: mockRepo,
  materiasPorEscola: jest.fn(),
}));

const { analyticsService } = await import('../src/services/analytics.service.js');

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('analyticsService.agregarPorCampanha', () => {
  const RESUMO = { totalInteracoes: 142, percentualSemResposta: 12.7 };
  const TOP = [
    { pergunta: 'O que é fração?', total: 18 },
    { pergunta: 'Como calcular área?', total: 11 },
  ];
  const VOLUME = [
    { data: '2025-07-01', total: 23 },
    { data: '2025-07-02', total: 31 },
  ];

  it('agrega as três queries em paralelo e retorna a estrutura correta', async () => {
    mockRepo.resumo.mockResolvedValue(RESUMO);
    mockRepo.topPerguntas.mockResolvedValue(TOP);
    mockRepo.volumePorDia.mockResolvedValue(VOLUME);

    const result = await analyticsService.agregarPorCampanha('matematica');

    expect(result).toEqual({
      campanhaId: 'matematica',
      totalInteracoes: 142,
      percentualSemResposta: 12.7,
      topPerguntas: TOP,
      volumePorDia: VOLUME,
    });

    // Confirma que as três queries foram chamadas com os defaults corretos
    expect(mockRepo.resumo).toHaveBeenCalledWith('matematica');
    expect(mockRepo.topPerguntas).toHaveBeenCalledWith('matematica', 10);
    expect(mockRepo.volumePorDia).toHaveBeenCalledWith('matematica', 30);
  });

  it('respeita parâmetros customizados de dias e top', async () => {
    mockRepo.resumo.mockResolvedValue(RESUMO);
    mockRepo.topPerguntas.mockResolvedValue(TOP);
    mockRepo.volumePorDia.mockResolvedValue(VOLUME);

    await analyticsService.agregarPorCampanha('historia', { dias: 7, top: 5 });

    expect(mockRepo.topPerguntas).toHaveBeenCalledWith('historia', 5);
    expect(mockRepo.volumePorDia).toHaveBeenCalledWith('historia', 7);
  });

  it('retorna zeros quando não há interações (resumo vazio)', async () => {
    mockRepo.resumo.mockResolvedValue({ totalInteracoes: 0, percentualSemResposta: null });
    mockRepo.topPerguntas.mockResolvedValue([]);
    mockRepo.volumePorDia.mockResolvedValue([]);

    const result = await analyticsService.agregarPorCampanha('ciencias');

    expect(result.totalInteracoes).toBe(0);
    // null do banco → 0 na resposta (NULLIF quando totalInteracoes=0)
    expect(result.percentualSemResposta).toBe(0);
    expect(result.topPerguntas).toEqual([]);
    expect(result.volumePorDia).toEqual([]);
  });

  it('nunca inclui campos de registro individual na resposta', async () => {
    mockRepo.resumo.mockResolvedValue(RESUMO);
    mockRepo.topPerguntas.mockResolvedValue(TOP);
    mockRepo.volumePorDia.mockResolvedValue(VOLUME);

    const result = await analyticsService.agregarPorCampanha('geografica');

    // Garante que call_sid, pergunta individual, resposta individual não existem
    expect(result).not.toHaveProperty('call_sid');
    expect(result).not.toHaveProperty('callSid');
    expect(result).not.toHaveProperty('resposta');
    expect(result).not.toHaveProperty('id');
  });
});
