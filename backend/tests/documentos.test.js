/**
 * Testes unitários — documentosService
 *
 * Cobre: upload (persiste + enfileira), remoção (com e sem chunks),
 * e o cenário de remoção durante PROCESSANDO.
 */

import { jest } from '@jest/globals';

const mockDocRepo = {
  criar: jest.fn(),
  buscarPorId: jest.fn(),
  buscarPorIdECampanha: jest.fn(),
  remover: jest.fn(),
  atualizarStatus: jest.fn(),
};

const mockCmpRepo = {
  buscarPorId: jest.fn(),
};

const mockWatsonx = {
  deleteDocumentChunks: jest.fn(),
  indexChunks: jest.fn(),
  search: jest.fn(),
};

const mockQueue = {
  enqueue: jest.fn(),
  setHandler: jest.fn(),
};

jest.unstable_mockModule('../src/repositories/documentos.repository.js', () => ({
  documentosRepository: mockDocRepo,
}));

jest.unstable_mockModule('../src/repositories/campanhas.repository.js', () => ({
  campanhasRepository: mockCmpRepo,
}));

jest.unstable_mockModule('../src/rag/watsonxClient.js', () => ({
  watsonxClient: mockWatsonx,
}));

jest.unstable_mockModule('../src/rag/queue.js', () => ({
  queue: mockQueue,
}));

// fs.unlink mockado para o caso de 404 após upload
jest.unstable_mockModule('fs/promises', () => ({
  default: { unlink: jest.fn().mockResolvedValue(undefined) },
}));

const { documentosService } = await import('../src/services/documentos.service.js');
const { fakeCampanha, fakeDocumento } = await import('./helpers.js');

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('documentosService.upload', () => {
  const file = {
    originalname: 'apostila.pdf',
    mimetype: 'application/pdf',
    path: 'uploads/123-apostila.pdf',
  };

  it('persiste documento e enfileira indexação', async () => {
    const campanha = fakeCampanha();
    const doc = fakeDocumento();
    mockCmpRepo.buscarPorId.mockResolvedValue(campanha);
    mockDocRepo.criar.mockResolvedValue(doc);

    const result = await documentosService.upload('cmp-test-1', file);

    expect(mockDocRepo.criar).toHaveBeenCalledWith(expect.objectContaining({
      campanhaId: 'cmp-test-1',
      nomeOriginal: 'apostila.pdf',
    }));
    expect(mockQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      documentoId: doc.id,
      campanhaId: 'cmp-test-1',
    }));
    expect(result.statusIndexacao).toBe('PROCESSANDO');
  });

  it('lança 404 e limpa arquivo se campanha não existir', async () => {
    mockCmpRepo.buscarPorId.mockResolvedValue(null);
    const fs = (await import('fs/promises')).default;

    await expect(documentosService.upload('inexistente', file))
      .rejects.toMatchObject({ status: 404 });

    expect(fs.unlink).toHaveBeenCalledWith(file.path);
    expect(mockDocRepo.criar).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('documentosService.remover', () => {
  it('remove chunks watsonx e depois o registro do banco', async () => {
    mockCmpRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockDocRepo.buscarPorIdECampanha.mockResolvedValue(fakeDocumento());
    mockWatsonx.deleteDocumentChunks.mockResolvedValue({ removidos: 2 });
    mockDocRepo.remover.mockResolvedValue({});

    await documentosService.remover('cmp-test-1', 'doc-test-1');

    expect(mockWatsonx.deleteDocumentChunks).toHaveBeenCalledWith('cmp-test-1', 'doc-test-1');
    expect(mockDocRepo.remover).toHaveBeenCalledWith('doc-test-1');
  });

  it('lança 404 se campanha não existir', async () => {
    mockCmpRepo.buscarPorId.mockResolvedValue(null);

    await expect(documentosService.remover('x', 'doc-1'))
      .rejects.toMatchObject({ status: 404 });
    expect(mockWatsonx.deleteDocumentChunks).not.toHaveBeenCalled();
  });

  it('lança 404 se documento não pertencer à campanha', async () => {
    mockCmpRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockDocRepo.buscarPorIdECampanha.mockResolvedValue(null);

    await expect(documentosService.remover('cmp-test-1', 'doc-errado'))
      .rejects.toMatchObject({ status: 404 });
    expect(mockWatsonx.deleteDocumentChunks).not.toHaveBeenCalled();
  });

  it('propaga erro do watsonx como 502 (não remove do banco)', async () => {
    mockCmpRepo.buscarPorId.mockResolvedValue(fakeCampanha());
    mockDocRepo.buscarPorIdECampanha.mockResolvedValue(fakeDocumento());
    const errWatsonx = new Error('timeout');
    errWatsonx.status = 502;
    mockWatsonx.deleteDocumentChunks.mockRejectedValue(errWatsonx);

    await expect(documentosService.remover('cmp-test-1', 'doc-test-1'))
      .rejects.toMatchObject({ status: 502 });
    expect(mockDocRepo.remover).not.toHaveBeenCalled();
  });
});
