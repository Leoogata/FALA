import type { RespostaMelhorar } from './types';
import { apiFetch } from './client';
import { mockMelhorarInstrucoes } from '../mock/handlers';
import { TIMEOUT_IA_MS } from '../config';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function melhorarInstrucoes(
  nome: string,
  instrucoes: string,
): Promise<RespostaMelhorar> {
  if (USE_MOCK) return mockMelhorarInstrucoes(nome, instrucoes);
  return apiFetch<RespostaMelhorar>(
    '/instrucoes/melhorar',
    {
      method: 'POST',
      body: JSON.stringify({ nome, instrucoes }),
    },
    TIMEOUT_IA_MS,
  );
}
