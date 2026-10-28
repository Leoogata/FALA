// ─── Tipos do contrato da API ─────────────────────────────────────────────────

export interface DocsCount {
  pronto: number;
  processando: number;
  erro: number;
}

export interface AgenteResumo {
  id: string;
  nome: string;
  ativa: boolean;
  criada_em: string;
  atualizada_em: string;
  docs: DocsCount;
}

export interface Material {
  id: string;
  campanha_id: string;
  nome_original: string;
  mime_type: 'application/pdf' | 'text/plain';
  status_indexacao: 'processando' | 'pronto' | 'erro';
  erro_indexacao: string | null;
  tamanho_bytes: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface AgenteDetalhe {
  id: string;
  nome: string;
  ativa: boolean;
  instrucoes: string | null;
  criada_em: string;
  atualizada_em: string;
  docs: DocsCount;
  documentos: Material[];
}

export interface ErroAPI {
  erro: string;
  mensagem: string;
}

export interface RespostaMelhorar {
  texto_sugerido: string;
  mudancas: string[];
  premissas: string[];
}

export interface RespostaTestar {
  resposta: string;
  confianca: number;
  sem_resposta: boolean;
}

export interface RespostaRemoverMaterial {
  campanha_ativa: boolean;
}

// Status calculado pelo front
export type StatusAgente = 'ativo' | 'inativo' | 'rascunho';

export function calcularStatus(agente: AgenteResumo | AgenteDetalhe): StatusAgente {
  if (agente.ativa) return 'ativo';
  return 'inativo';
}

// Classe de erro tipada
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly erro: string,
    public readonly mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ApiError';
  }
}
