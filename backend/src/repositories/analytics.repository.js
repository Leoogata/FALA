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

/**
 * Contagem de interações classificadas por matéria para uma escola,
 * em uma janela de tempo definida por início e fim em UTC.
 *
 * Retorna somente aggregados — sem transcrições, identificadores de aluno
 * ou identificadores de chamadas. Cache-Control aplicado no controller.
 *
 * @param {string} escolaId
 * @param {Date} inicio
 * @param {Date} fim
 * @returns {Promise<{
 *   total: number,
 *   classificadas: number,
 *   indeterminadas: number,
 *   falhasClassificacao: number,
 *   materias: Array<{ materia: string, total: number }>
 * }>}
 */
export async function materiasPorEscola(escolaId, inicio, fim) {
  // Turnos elegíveis: classificacao_status preenchido, dentro da janela e não vencidos
  const [totais, porcMateria] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "total",
        SUM(CASE WHEN i.classificacao_status = 'classificada'    THEN 1 ELSE 0 END)::int AS "classificadas",
        SUM(CASE WHEN i.classificacao_status = 'indeterminada'   THEN 1 ELSE 0 END)::int AS "indeterminadas",
        SUM(CASE WHEN i.classificacao_status = 'erro'            THEN 1 ELSE 0 END)::int AS "falhasClassificacao"
      FROM interacoes i
      JOIN conversas c ON c.id = i.conversa_id
      WHERE c.escola_id = ${escolaId}
        AND i.classificacao_status IS NOT NULL
        AND i.recebida_em >= ${inicio}
        AND i.recebida_em <  ${fim}
        AND i.expira_em   >  ${fim}
    `,
    prisma.$queryRaw`
      SELECT
        i.materia_classificada::text AS "materia",
        COUNT(*)::int                AS "total"
      FROM interacoes i
      JOIN conversas c ON c.id = i.conversa_id
      WHERE c.escola_id = ${escolaId}
        AND i.classificacao_status = 'classificada'
        AND i.materia_classificada IS NOT NULL
        AND i.recebida_em >= ${inicio}
        AND i.recebida_em <  ${fim}
        AND i.expira_em   >  ${fim}
      GROUP BY i.materia_classificada
    `,
  ]);

  return {
    total: totais[0]?.total ?? 0,
    classificadas: totais[0]?.classificadas ?? 0,
    indeterminadas: totais[0]?.indeterminadas ?? 0,
    falhasClassificacao: totais[0]?.falhasClassificacao ?? 0,
    materias: porcMateria,
  };
}
