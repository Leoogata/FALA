/**
 * Middleware de erro centralizado.
 *
 * Todos os erros lançados nos controllers/services chegam aqui.
 * Erros com `status` definido são tratados como erros de domínio (4xx/5xx).
 * Erros sem `status` resultam em 500.
 */

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500;
  const message = err.message ?? 'Erro interno do servidor';

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({ error: message });
}

/**
 * Cria um erro de domínio com status HTTP embutido.
 * @param {number} status
 * @param {string} message
 */
export function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
