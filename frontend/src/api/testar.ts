import type { RespostaTestar } from './types';
import { apiFetch } from './client';
import { mockTestarAgente } from '../mock/handlers';
import { TIMEOUT_IA_MS } from '../config';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function testarAgente(
  agenteId: string,
  pergunta: string,
): Promise<RespostaTestar> {
  if (USE_MOCK) return mockTestarAgente(agenteId, pergunta);
  return apiFetch<RespostaTestar>(
    `/campanhas/${agenteId}/testar`,
    {
      method: 'POST',
      body: JSON.stringify({ pergunta }),
    },
    TIMEOUT_IA_MS,
  );
}
