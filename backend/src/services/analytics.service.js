import { analyticsRepository } from '../repositories/analytics.repository.js';

export const analyticsService = {
  /**
   * Retorna dados agregados de uma campanha para o dashboard.
   * Nunca expõe registros individuais — todos os campos são contagens ou médias.
   *
   * @param {string} campanhaId - slug semântico da campanha
   * @param {{ dias?: number, top?: number }} opcoes
   * @returns {Promise<{
   *   campanhaId: string,
   *   totalInteracoes: number,
   *   percentualSemResposta: number,
   *   topPerguntas: Array<{pergunta: string, total: number}>,
   *   volumePorDia: Array<{data: string, total: number}>
   * }>}
   */
  async agregarPorCampanha(campanhaId, { dias = 30, top = 10 } = {}) {
    const [resumo, topPerguntas, volumePorDia] = await Promise.all([
      analyticsRepository.resumo(campanhaId),
      analyticsRepository.topPerguntas(campanhaId, top),
      analyticsRepository.volumePorDia(campanhaId, dias),
    ]);

    return {
      campanhaId,
      totalInteracoes: resumo.totalInteracoes ?? 0,
      percentualSemResposta: resumo.percentualSemResposta ?? 0,
      topPerguntas,
      volumePorDia,
    };
  },
};
