import prisma from '../config/prisma.js';

export const analyticsRepository = {
  /**
   * Resumo agregado: total de interações e % sem resposta.
   * Usa $queryRaw para garantir que nunca vaze registros individuais.
   */
  async resumo(campanhaId) {
    const rows = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int                                                          AS "totalInteracoes",
        ROUND(
          100.0 * SUM(CASE WHEN sem_resposta THEN 1 ELSE 0 END)::numeric
            / NULLIF(COUNT(*), 0),
          1
        )::float                                                               AS "percentualSemResposta"
      FROM interacoes
      WHERE campanha_id = ${campanhaId}
        AND expira_em > NOW()
        AND status <> 'RECEBIDO'
    `;
    return rows[0] ?? { totalInteracoes: 0, percentualSemResposta: 0 };
  },

  /**
   * Top perguntas por frequência, limitado a `limit` itens.
   * Nunca retorna registros individuais — apenas contagens agrupadas.
   */
  async topPerguntas(campanhaId, limit = 10) {
    return prisma.$queryRaw`
      SELECT
        pergunta,
        COUNT(*)::int AS total
      FROM interacoes
      WHERE campanha_id = ${campanhaId}
        AND expira_em > NOW()
        AND status <> 'RECEBIDO'
        AND pergunta IS NOT NULL AND NOT texto_suprimido
      GROUP BY pergunta
      ORDER BY total DESC
      LIMIT ${limit}
    `;
  },

  /**
   * Volume de interações por dia nos últimos `dias` dias.
   * Retorna array ordenado por data ASC.
   */
  async volumePorDia(campanhaId, dias = 30) {
    return prisma.$queryRaw`
      SELECT
        TO_CHAR(DATE(recebida_em), 'YYYY-MM-DD') AS data,
        COUNT(*)::int                          AS total
      FROM interacoes
      WHERE campanha_id = ${campanhaId}
        AND expira_em > NOW()
        AND status <> 'RECEBIDO'
        AND recebida_em >= NOW() - (${dias} || ' days')::interval
      GROUP BY DATE(recebida_em)
      ORDER BY DATE(recebida_em) ASC
    `;
  },
};
