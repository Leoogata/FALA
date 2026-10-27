/**
 * Middleware factory de validação com Zod.
 *
 * Uso:
 *   router.post('/', validate({ body: MeuSchema }), controller)
 *
 * Valida body, params e/ou query de acordo com os schemas passados.
 * Em caso de falha retorna 400 com a lista de erros formatados.
 */
export function validate(schemas) {
  return (req, res, next) => {
    const errors = {};

    for (const [key, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        errors[key] = result.error.flatten().fieldErrors;
      } else {
        req[key] = result.data; // substitui pelo valor parseado/coercido
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Dados inválidos', details: errors });
    }

    next();
  };
}
