/**
 * Testes unitários — pipeline RAG
 *
 * Cobre:
 *   - Fluxo feliz: lê arquivo → chunka → indexa → status PRONTO
 *   - Documento deletado antes do pipeline rodar → deleteChunks + descarta
 *   - Documento deletado durante a indexação → deleteChunks + descarta
 *   - Falha no watsonx → deleteChunks + status ERRO
 *   - Arquivo ausente no disco → status ERRO
 *   - Arquivo vazio → status ERRO
 */

import { jest } from '@jest/globals';

const mockDocRepo = {
  buscarPorId: jest.fn(),
  atualizarStatus: jest.fn(),
};

const mockWatsonx = {
  indexChunks: jest.fn(),
  deleteDocumentChunks: jest.fn(),
};

const mockQueue = {
  enqueue: jest.fn(),
  setHandler: jest.fn(),
};

const mockFs = {
  readFile: jest.fn(),
  access: jest.fn(),
};

jest.unstable_mockModule('../../src/repositories/documentos.repository.js', () => ({
  documentosRepository: mockDocRepo,
}));

jest.unstable_mockModule('../../src/rag/watsonxClient.js', () => ({
  watsonxClient: mockWatsonx,
}));

jest.unstable_mockModule('../../src/rag/queue.js', () => ({
  queue: mockQueue,
}));

jest.unstable_mockModule('fs/promises', () => ({
  default: mockFs,
}));

const { processar } = await import('../../src/rag/pipeline.js');
const { fakeDocumento } = await import('../helpers.js');

const JOB = {
  documentoId: 'doc-test-1',
  campanhaId: 'cmp-test-1',
  caminhoArquivo: 'uploads/123-apostila.txt',
};

const TEXTO_VALIDO = 'Primeiro parágrafo com conteúdo didático relevante para o teste.\n\nSegundo parágrafo com mais conteúdo para garantir chunking.';

beforeEach(() => {
  jest.clearAllMocks();
  mockWatsonx.deleteDocumentChunks.mockResolvedValue({ removidos: 0 });
  mockWatsonx.indexChunks.mockResolvedValue({ indexados: 2 });
  mockDocRepo.atualizarStatus.mockResolvedValue({});
  mockFs.access.mockResolvedValue(undefined);
  mockFs.readFile.mockResolvedValue(Buffer.from(TEXTO_VALIDO));
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — fluxo feliz', () => {
  it('indexa chunks e marca documento como PRONTO', async () => {
    const doc = fakeDocumento({ mimeType: 'text/plain' });
    mockDocRepo.buscarPorId
      .mockResolvedValueOnce(doc)   // primeira chamada: busca para obter mimeType
      .mockResolvedValueOnce(doc);  // segunda chamada: verifica se ainda existe após indexar

    await processar(JOB);

    expect(mockWatsonx.indexChunks).toHaveBeenCalledWith(
      'cmp-test-1',
      expect.arrayContaining([expect.objectContaining({ documentoId: 'doc-test-1' })]),
    );
    expect(mockDocRepo.atualizarStatus).toHaveBeenCalledWith('doc-test-1', 'PRONTO');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — documento deletado antes de rodar', () => {
  it('chama deleteDocumentChunks e descarta silenciosamente', async () => {
    mockDocRepo.buscarPorId.mockResolvedValue(null);

    await processar(JOB);

    expect(mockWatsonx.deleteDocumentChunks).toHaveBeenCalledWith('cmp-test-1', 'doc-test-1');
    expect(mockWatsonx.indexChunks).not.toHaveBeenCalled();
    expect(mockDocRepo.atualizarStatus).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — documento deletado durante a indexação', () => {
  it('chama deleteDocumentChunks para limpar chunks parciais e descarta', async () => {
    const doc = fakeDocumento({ mimeType: 'text/plain' });
    mockDocRepo.buscarPorId
      .mockResolvedValueOnce(doc)   // encontra na primeira busca
      .mockResolvedValueOnce(null); // deletado enquanto indexava

    await processar(JOB);

    expect(mockWatsonx.indexChunks).toHaveBeenCalled();
    expect(mockWatsonx.deleteDocumentChunks).toHaveBeenCalledWith('cmp-test-1', 'doc-test-1');
    expect(mockDocRepo.atualizarStatus).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — falha no watsonx', () => {
  it('chama deleteDocumentChunks (limpeza parcial) e marca ERRO', async () => {
    const doc = fakeDocumento({ mimeType: 'text/plain' });
    mockDocRepo.buscarPorId
      .mockResolvedValueOnce(doc)  // busca mimeType
      .mockResolvedValueOnce(doc); // verifica após erro
    mockWatsonx.indexChunks.mockRejectedValue(new Error('watsonx timeout'));

    await processar(JOB);

    expect(mockWatsonx.deleteDocumentChunks).toHaveBeenCalledWith('cmp-test-1', 'doc-test-1');
    expect(mockDocRepo.atualizarStatus).toHaveBeenCalledWith(
      'doc-test-1', 'ERRO', 'watsonx timeout',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — arquivo ausente no disco', () => {
  it('marca documento como ERRO com mensagem descritiva', async () => {
    const doc = fakeDocumento({ mimeType: 'text/plain' });
    mockDocRepo.buscarPorId
      .mockResolvedValueOnce(doc)
      .mockResolvedValueOnce(doc);
    mockFs.access.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    await processar(JOB);

    expect(mockDocRepo.atualizarStatus).toHaveBeenCalledWith(
      'doc-test-1', 'ERRO', expect.stringContaining('ENOENT'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('pipeline.processar — arquivo vazio', () => {
  it('marca documento como ERRO indicando arquivo sem texto', async () => {
    const doc = fakeDocumento({ mimeType: 'text/plain' });
    mockDocRepo.buscarPorId.mockResolvedValue(doc);
    mockFs.readFile.mockResolvedValue(Buffer.from(''));

    await processar(JOB);

    expect(mockDocRepo.atualizarStatus).toHaveBeenCalledWith(
      'doc-test-1', 'ERRO', expect.stringContaining('vazio'),
    );
  });
});
