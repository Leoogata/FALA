/**
 * Helpers compartilhados entre os testes.
 *
 * Como não há banco real nos testes unitários, os repositories são
 * mockados via jest.unstable_mockModule antes de importar os services.
 */

/**
 * Cria um objeto de campanha fake com valores padrão sobrescrevíveis.
 */
export function fakeCampanha(overrides = {}) {
  return {
    id: 'cmp-test-1',
    nome: 'Campanha Teste',
    ativa: true,
    criadaEm: new Date('2024-01-01T00:00:00Z'),
    atualizadaEm: new Date('2024-01-01T00:00:00Z'),
    documentos: [],
    _count: { documentos: 0 },
    ...overrides,
  };
}

/**
 * Cria um objeto de documento fake com valores padrão sobrescrevíveis.
 */
export function fakeDocumento(overrides = {}) {
  return {
    id: 'doc-test-1',
    campanhaId: 'cmp-test-1',
    nomeOriginal: 'apostila.pdf',
    mimeType: 'application/pdf',
    caminhoArquivo: 'uploads/123-apostila.pdf',
    statusIndexacao: 'PROCESSANDO',
    erroIndexacao: null,
    criadoEm: new Date('2024-01-01T00:00:00Z'),
    atualizadoEm: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}
