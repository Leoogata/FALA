/**
 * Testes unitários — campanhasService
 *
 * Mocka o campanhasRepository para testar as regras de negócio
 * sem dependência de banco de dados.
 */

import { jest } from '@jest/globals';

// Mocks devem ser declarados antes dos imports que os usam
const mockRepo = {
  criar: jest.fn(),
  listar: jest.fn(),
  buscarPorId: jest.fn(),
  atualizar: jest.fn(),
  remover: jest.fn(),
  contarDocumentos: jest.fn(),
  listarDocumentos: jest.fn(),
};

jest.unstable_mockModule('../src/repositories/campanhas.repository.js', () => ({
  campanhasRepository: mockRepo,
}));

// Prisma também é importado pelo service (transação cascade)
jest.unstable_mockModule('../src/config/prisma.js', () => ({
  default: {
    $transaction: jest.fn(),
    documento: { deleteMany: jest.fn() },
    campanha: { delete: jest.fn() },
  },
}));

const { campanhasService } = await import('../src/services/campanhas.service.js');
const { fakeCampanha } = await import('./helpers.js');

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('campanhasService.criar', () => {
  it('delega ao repository e retorna a campanha criada', async () => {
    const campanha = fakeCampanha();
    mockRepo.criar.mockResolvedValue(campanha);

    const result = await campanhasService.criar({ nome: 'Nova' });

    expect(mockRepo.criar).toHaveBeenCalledWith({ nome: 'Nova' });
    expect(result).toEqual(campanha);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('campanhasService.buscarPorId', () => {
  it('retorna a campanha quando encontrada', async () => {
    const campanha = fakeCampanha();
    mockRepo.buscarPorId.mockResolvedValue(campanha);

    const result = await campanhasService.buscarPorId('cmp-test-1');
    expect(result).toEqual(campanha);
  });

  it('lança 404 quando não encontrada', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    await expect(campanhasService.buscarPorId('inexistente'))
      .rejects.toMatchObject({ status: 404, message: 'Campanha não encontrada' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('campanhasService.atualizar', () => {
  it('lança 404 se campanha não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    await expect(campanhasService.atualizar('x', { nome: 'novo' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('chama atualizar e retorna campanha atualizada', async () => {
    const campanha = fakeCampanha();
    const atualizada = { ...campanha, nome: 'Novo Nome' };
    mockRepo.buscarPorId.mockResolvedValue(campanha);
    mockRepo.atualizar.mockResolvedValue(atualizada);

    const result = await campanhasService.atualizar('cmp-test-1', { nome: 'Novo Nome' });
    expect(result.nome).toBe('Novo Nome');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('campanhasService.remover (sem cascade)', () => {
  it('lança 404 se campanha não existir', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    await expect(campanhasService.remover('x'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('lança 409 se houver documentos', async () => {
    mockRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockRepo.contarDocumentos.mockResolvedValue(3);

    await expect(campanhasService.remover('cmp-test-1'))
      .rejects.toMatchObject({ status: 409 });
  });

  it('remove campanha sem documentos', async () => {
    mockRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockRepo.contarDocumentos.mockResolvedValue(0);
    mockRepo.remover.mockResolvedValue({});

    await campanhasService.remover('cmp-test-1');
    expect(mockRepo.remover).toHaveBeenCalledWith('cmp-test-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('campanhasService.remover (cascade=true)', () => {
  it('chama deletarChunksFn para cada documento e remove tudo em transação', async () => {
    const docs = [
      { id: 'doc-1', campanhaId: 'cmp-test-1' },
      { id: 'doc-2', campanhaId: 'cmp-test-1' },
    ];
    mockRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockRepo.listarDocumentos.mockResolvedValue(docs);

    const prisma = (await import('../src/config/prisma.js')).default;
    prisma.$transaction.mockResolvedValue([]);

    const deletarChunksFn = jest.fn().mockResolvedValue({ removidos: 0 });

    await campanhasService.remover('cmp-test-1', { cascade: true, deletarChunksFn });

    expect(deletarChunksFn).toHaveBeenCalledTimes(2);
    expect(deletarChunksFn).toHaveBeenCalledWith('cmp-test-1', 'doc-1');
    expect(deletarChunksFn).toHaveBeenCalledWith('cmp-test-1', 'doc-2');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
