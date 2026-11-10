import { analyticsRepository, materiasPorEscola } from '../repositories/analytics.repository.js';

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

const TODAS_MATERIAS = ['ciencias', 'historia', 'matematica', 'portugues', 'geografia'];

/**
 * Agrega contagem de dúvidas por matéria para uma escola.
 * Janela: [fim - dias*24h, fim) em UTC. fim = agora.
 *
 * @param {string} escolaId
 * @param {{ dias?: number }} opcoes
 * @returns {Promise<object>}
 */
export async function agregarMateriasPorEscola(escolaId, { dias = 7 } = {}) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 24 * 60 * 60 * 1000);

  const raw = await materiasPorEscola(escolaId, inicio, fim);

  const total = (raw.total ?? 0);
  const classificadas = (raw.classificadas ?? 0);

  // Montar mapa de matérias a partir do resultado da query
  const mapaContagem = Object.fromEntries(raw.materias.map((m) => [m.materia, m.total]));

  // Garantir as cinco matérias, incluindo as com zero
  const materiasComZero = TODAS_MATERIAS.map((m) => ({
    materia: m,
    total: mapaContagem[m] ?? 0,
    percentual: total > 0 ? Math.round(((mapaContagem[m] ?? 0) / total) * 1000) / 10 : 0,
  })).sort((a, b) => b.total - a.total || a.materia.localeCompare(b.materia));

  return {
    periodo: {
      dias,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
    },
    total,
    classificadas,
    indeterminadas: raw.indeterminadas ?? 0,
    falhasClassificacao: raw.falhasClassificacao ?? 0,
    coberturaPercentual: total > 0 ? Math.round((classificadas / total) * 1000) / 10 : 0,
    materias: materiasComZero,
  };
}
