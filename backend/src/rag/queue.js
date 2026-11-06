/**
 * Fila de indexação RAG — MVP em memória.
 *
 * Interface pública:
 *   queue.enqueue(job)      — adiciona um job à fila
 *   queue.setHandler(fn)    — registra o processador (chamado pelo pipeline)
 *
 * Para substituir por BullMQ / SQS / RabbitMQ:
 *   1. Reimplemente este módulo com a mesma interface
 *   2. Nenhum outro arquivo precisa mudar
 *
 * Comportamento atual (setImmediate):
 *   - O job é processado na próxima iteração do event loop após o HTTP 201 ser enviado
 *   - O estado pendente é persistido em Documento.PROCESSANDO
 *   - Na inicialização, recovery.js reenfileira os trabalhos interrompidos
 */

let handler = null;

export const queue = {
  /**
   * @param {object} job
   * @param {string} job.documentoId
   * @param {string} job.campanhaId
   * @param {string} job.caminhoArquivo
   */
  enqueue(job) {
    setImmediate(() => {
      if (!handler) {
        console.warn('[queue] Nenhum handler registrado — job descartado:', job.documentoId);
        return;
      }
      handler(job).catch((err) => {
        console.error('[queue] Erro não tratado no handler:', err);
      });
    });
  },

  /**
   * @param {(job: object) => Promise<void>} fn
   */
  setHandler(fn) {
    handler = fn;
  },
};
