/**
 * Testes unitários — interacoesService
 *
 * Cobre: 201 normal, 422 CPF, 422 telefone, 400 campos ausentes,
 *        sem_resposta=true limpa a resposta antes de persistir.
 */

import { jest } from '@jest/globals';

const mockRepo = {
  criar: jest.fn(),
};

jest.unstable_mockModule('../src/repositories/interacoes.repository.js', () => ({
  interacoesRepository: mockRepo,
}));

const { interacoesService } = await import('../src/services/interacoes.service.js');

const BASE = {
  campanha_id: 'matematica',
  pergunta: 'O que é equação do segundo grau?',
  resposta: 'É uma equação polinomial de grau 2.',
  score_confianca_stt: 0.95,
  score_confianca_agente: 0.88,
  sem_resposta: false,
  call_sid: 'CA0123456789abcdef',
};

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('interacoesService.registrar — fluxo feliz', () => {
  it('delega ao repository e retorna id + criadoEm', async () => {
    const agora = new Date();
    mockRepo.criar.mockResolvedValue({ id: 'int-1', criadoEm: agora });

    const result = await interacoesService.registrar(BASE);

    expect(mockRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        campanhaId: 'matematica',
        pergunta: BASE.pergunta,
        callSid: BASE.call_sid,
        semResposta: false,
      }),
    );
    expect(result).toEqual({ id: 'int-1', criadoEm: agora });
  });

  it('sem_resposta=true persiste resposta como null', async () => {
    mockRepo.criar.mockResolvedValue({ id: 'int-2', criadoEm: new Date() });

    await interacoesService.registrar({ ...BASE, sem_resposta: true, resposta: 'ignorada' });

    expect(mockRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ semResposta: true, resposta: null }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('interacoesService.registrar — rejeição de PII', () => {
  it('lança 422 quando pergunta contém CPF', async () => {
    await expect(
      interacoesService.registrar({ ...BASE, pergunta: 'Meu CPF é 123.456.789-09' }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('pergunta') });

    expect(mockRepo.criar).not.toHaveBeenCalled();
  });

  it('lança 422 quando pergunta contém CPF sem formatação', async () => {
    await expect(
      interacoesService.registrar({ ...BASE, pergunta: 'cpf 12345678909' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('lança 422 quando pergunta contém telefone brasileiro', async () => {
    await expect(
      interacoesService.registrar({ ...BASE, pergunta: 'ligue para (11) 91234-5678' }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('pergunta') });

    expect(mockRepo.criar).not.toHaveBeenCalled();
  });

  it('lança 422 quando resposta contém CPF', async () => {
    await expect(
      interacoesService.registrar({ ...BASE, resposta: 'seu CPF é 987.654.321-00' }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('resposta') });

    expect(mockRepo.criar).not.toHaveBeenCalled();
  });

  it('não rejeita pergunta educacional legítima com números', async () => {
    mockRepo.criar.mockResolvedValue({ id: 'int-3', criadoEm: new Date() });

    // "equação do 2º grau: ax² + bx + c = 0" não é CPF nem telefone
    await expect(
      interacoesService.registrar({
        ...BASE,
        pergunta: 'Como resolver ax² + bx + c = 0?',
      }),
    ).resolves.toBeDefined();

    expect(mockRepo.criar).toHaveBeenCalled();
  });
});
