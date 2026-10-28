import { ApiError } from './types';
import { TIMEOUT_PADRAO_MS } from '../config';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = TIMEOUT_PADRAO_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'A requisição demorou demais. Tente de novo.');
    }
    throw new ApiError(0, 'sem_rede', 'Não foi possível conectar. Verifique sua internet e tente de novo.');
  }
  clearTimeout(timer);

  if (!res.ok) {
    let body: { erro?: string; mensagem?: string; error?: string } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    // Suporta tanto { erro, mensagem } (formato antigo/mock) quanto { error } (backend)
    const erro = body.erro ?? body.error ?? 'erro_desconhecido';
    const mensagem = body.mensagem ?? body.error ?? 'Algo deu errado. Tente de novo.';
    throw new ApiError(res.status, erro, mensagem);
  }

  return res.json() as Promise<T>;
}

// Upload com progresso via XHR
export function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress: (pct: number) => void,
  timeoutMs = TIMEOUT_PADRAO_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}${path}`);
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.ontimeout = () => {
      reject(new ApiError(0, 'timeout', 'A requisição demorou demais. Tente de novo.'));
    };

    xhr.onerror = () => {
      reject(new ApiError(0, 'sem_rede', 'Não foi possível conectar. Verifique sua internet e tente de novo.'));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiError(xhr.status, 'parse_error', 'Resposta inválida do servidor.'));
        }
      } else {
        let body: { erro?: string; mensagem?: string; error?: string } = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        reject(new ApiError(
          xhr.status,
          body.erro ?? body.error ?? 'erro_desconhecido',
          body.mensagem ?? body.error ?? 'Algo deu errado. Tente de novo.',
        ));
      }
    };

    xhr.send(formData);
  });
}
