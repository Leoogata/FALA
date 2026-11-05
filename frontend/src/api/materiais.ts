import type { Material, RespostaRemoverMaterial } from './types';
import { apiFetch, apiUpload } from './client';
import {
  mockListarMateriais,
  mockEnviarMaterial,
  mockRemoverMaterial,
} from '../mock/handlers';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export function listarMateriais(agenteId: string): Promise<Material[]> {
  if (USE_MOCK) return mockListarMateriais(agenteId);
  return apiFetch<Material[]>(`/campanhas/${agenteId}/documentos`);
}

export function enviarMaterial(
  agenteId: string,
  arquivo: File,
  onProgress: (pct: number) => void,
): Promise<Material> {
  if (USE_MOCK) return mockEnviarMaterial(agenteId, arquivo, onProgress);
  const form = new FormData();
  form.append('arquivo', arquivo);
  return apiUpload<Material>(`/campanhas/${agenteId}/documentos`, form, onProgress);
}

export function removerMaterial(
  agenteId: string,
  docId: string,
): Promise<RespostaRemoverMaterial> {
  if (USE_MOCK) return mockRemoverMaterial(agenteId, docId);
  return apiFetch<RespostaRemoverMaterial>(
    `/campanhas/${agenteId}/documentos/${docId}`,
    { method: 'DELETE' },
  );
}
