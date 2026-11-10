import { apiFetch } from './client';
import type { AnalyticsMaterias } from './types';
import { mockMateriasPorEscola } from '../mock/handlers';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function buscarMateriasPorEscola(dias: 1 | 7 = 7): Promise<AnalyticsMaterias> {
  if (USE_MOCK) return mockMateriasPorEscola(dias);
  return apiFetch<AnalyticsMaterias>(`/analytics/materias?dias=${dias}`);
}
