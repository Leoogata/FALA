import type { AgenteResumo, AgenteDetalhe } from './types';
import { apiFetch } from './client';
import {
  mockListarAgentes,
  mockCriarAgente,
  mockBuscarAgente,
  mockAtualizarAgente,
} from '../mock/handlers';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function listarAgentes(filtro?: { ativa?: boolean }): Promise<AgenteResumo[]> {
  if (USE_MOCK) return mockListarAgentes(filtro);
  const params = filtro?.ativa !== undefined ? `?ativa=${filtro.ativa}` : '';
  return apiFetch<AgenteResumo[]>(`/campanhas${params}`);
}

export function criarAgente(nome: string): Promise<AgenteDetalhe> {
  if (USE_MOCK) return mockCriarAgente(nome);
  return apiFetch<AgenteDetalhe>('/campanhas', {
    method: 'POST',
    body: JSON.stringify({ nome }),
  });
}

export function buscarAgente(id: string): Promise<AgenteDetalhe> {
  if (USE_MOCK) return mockBuscarAgente(id);
  return apiFetch<AgenteDetalhe>(`/campanhas/${id}`);
}

export function atualizarAgente(
  id: string,
  dados: Partial<{ nome: string; instrucoes: string; ativa: boolean }>,
): Promise<AgenteDetalhe> {
  if (USE_MOCK) return mockAtualizarAgente(id, dados);
  return apiFetch<AgenteDetalhe>(`/campanhas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
}
