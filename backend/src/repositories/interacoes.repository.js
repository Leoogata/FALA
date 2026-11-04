import prisma from '../config/prisma.js';

export const interacoesRepository = {
  /**
   * Persiste uma interação de voz anônima.
   * Retorna apenas id e criadoEm — nunca ecoa os dados de volta.
   */
  async criar({
    campanhaId,
    pergunta,
    resposta,
    scoreConfiancaStt,
    scoreConfiancaAgente,
    semResposta,
    callSid,
  }) {
    return prisma.interacao.create({
      data: {
        campanhaId,
        pergunta,
        resposta: resposta ?? null,
        scoreConfiancaStt: scoreConfiancaStt ?? null,
        scoreConfiancaAgente: scoreConfiancaAgente ?? null,
        semResposta,
        callSid,
      },
      select: { id: true, criadoEm: true },
    });
  },
};
