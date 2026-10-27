/**
 * watsonxClient — contrato da interface de acesso ao watsonx.
 *
 * Este módulo exporta o cliente correto de acordo com WATSONX_MOCK:
 *   - true  → mock em memória (desenvolvimento / testes)
 *   - false → cliente real (a ser implementado pela Pessoa B / US-08)
 *
 * Contrato completo: docs/contracts/watsonx-client.md
 */

import { env } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock — armazena chunks em memória, por campanha → por documento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estrutura interna:
 *   store: Map<campanhaId, Map<documentoId, Chunk[]>>
 */
const store = new Map();

function getCampanhaMap(campanhaId) {
  if (!store.has(campanhaId)) store.set(campanhaId, new Map());
  return store.get(campanhaId);
}

const mockClient = {
  /**
   * Indexa chunks de um documento em uma campanha.
   * Idempotente: re-indexar os mesmos documentoId + ordem substitui os chunks existentes.
   *
   * @param {string} campanhaId
   * @param {Array<{ documentoId: string, texto: string, ordem: number }>} chunks
   * @returns {Promise<{ indexados: number }>}
   */
  async indexChunks(campanhaId, chunks) {
    const campanhaMap = getCampanhaMap(campanhaId);
    // Substitui todos os chunks do documento (idempotência por documentoId)
    const byDoc = Map.groupBy(chunks, (c) => c.documentoId);
    for (const [documentoId, docChunks] of byDoc) {
      campanhaMap.set(documentoId, docChunks);
    }
    return { indexados: chunks.length };
  },

  /**
   * Busca chunks relevantes para uma query, restrito a uma campanha.
   *
   * No mock: retorna todos os chunks da campanha ordenados por posição
   * (sem scoring real). Suficiente para testes de integração.
   *
   * @param {string} campanhaId
   * @param {string} query
   * @param {{ topK?: number }} opcoes
   * @returns {Promise<{ resultados: Array<{ documentoId: string, texto: string, score: number }> }>}
   */
  async search(campanhaId, query, { topK = 5 } = {}) {
    const campanhaMap = getCampanhaMap(campanhaId);
    const todos = [];
    for (const chunks of campanhaMap.values()) {
      todos.push(...chunks);
    }
    // Mock simples: filtra chunks que contêm a query (case-insensitive) ou retorna os primeiros
    const lower = query.toLowerCase();
    const matched = todos.filter((c) => c.texto.toLowerCase().includes(lower));
    const resultados = (matched.length > 0 ? matched : todos)
      .slice(0, topK)
      .map((c) => ({ documentoId: c.documentoId, texto: c.texto, score: 1.0 }));
    return { resultados };
  },

  /**
   * Remove todos os chunks de um documento de uma campanha.
   * Idempotente: retorna { removidos: 0 } se não houver nada, sem lançar erro.
   *
   * @param {string} campanhaId
   * @param {string} documentoId
   * @returns {Promise<{ removidos: number }>}
   */
  async deleteDocumentChunks(campanhaId, documentoId) {
    const campanhaMap = getCampanhaMap(campanhaId);
    const chunks = campanhaMap.get(documentoId) ?? [];
    const removidos = chunks.length;
    campanhaMap.delete(documentoId);
    return { removidos };
  },

  /** Utilitário de teste — inspeciona o estado interno do mock. */
  _inspect(campanhaId, documentoId) {
    const campanhaMap = store.get(campanhaId);
    if (!campanhaMap) return [];
    return campanhaMap.get(documentoId) ?? [];
  },

  /** Utilitário de teste — limpa todo o estado do mock. */
  _reset() {
    store.clear();
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Cliente real — placeholder para a Pessoa B implementar (US-08)
// ─────────────────────────────────────────────────────────────────────────────

const realClient = {
  async indexChunks(_campanhaId, _chunks) {
    throw new Error('Cliente watsonx real não implementado. Configure WATSONX_MOCK=true.');
  },
  async search(_campanhaId, _query, _opcoes) {
    throw new Error('Cliente watsonx real não implementado. Configure WATSONX_MOCK=true.');
  },
  async deleteDocumentChunks(_campanhaId, _documentoId) {
    throw new Error('Cliente watsonx real não implementado. Configure WATSONX_MOCK=true.');
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Exportação — seleciona client conforme WATSONX_MOCK
// ─────────────────────────────────────────────────────────────────────────────

export const watsonxClient = env.WATSONX_MOCK ? mockClient : realClient;
