import type { AgenteDetalhe, Material, DocsCount } from '../api/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MIN = 60_000;
const H = 3_600_000;
const D = 86_400_000;

function uid(): string {
  return crypto.randomUUID();
}

function makeMaterial(
  partial: Omit<Material, 'id' | 'campanha_id' | 'atualizado_em'> & { campanha_id?: string },
): Omit<Material, 'campanha_id'> & { campanha_id: string } {
  return {
    id: uid(),
    campanha_id: partial.campanha_id ?? '',
    nome_original: partial.nome_original,
    mime_type: partial.mime_type,
    status_indexacao: partial.status_indexacao,
    erro_indexacao: partial.erro_indexacao,
    tamanho_bytes: partial.tamanho_bytes,
    criado_em: partial.criado_em,
    atualizado_em: partial.criado_em,
  };
}

export function calcDocs(materiais: Material[]): DocsCount {
  return materiais.reduce(
    (acc, m) => {
      if (m.status_indexacao === 'pronto') acc.pronto++;
      else if (m.status_indexacao === 'processando') acc.processando++;
      else acc.erro++;
      return acc;
    },
    { pronto: 0, processando: 0, erro: 0 },
  );
}

// ─── Dados iniciais ───────────────────────────────────────────────────────────

const id1 = uid();
const id2 = uid();
const id3 = uid();
const id4 = uid();

const docs1: Material[] = [
  makeMaterial({ campanha_id: id1, nome_original: 'apostila-equacoes-primeiro-grau.pdf', mime_type: 'application/pdf', status_indexacao: 'pronto', erro_indexacao: null, tamanho_bytes: 2516582, criado_em: ago(2 * D) }),
  makeMaterial({ campanha_id: id1, nome_original: 'lista-porcentagem-simulado.pdf', mime_type: 'application/pdf', status_indexacao: 'pronto', erro_indexacao: null, tamanho_bytes: 845000, criado_em: ago(2 * D) }),
];

// Este material muda para pronto após 2-4s (ver mock/handlers.ts)
const processingDocId = uid();
const docs2: Material[] = [
  { id: processingDocId, campanha_id: id2, nome_original: 'chico-mendes-texto-base.pdf', mime_type: 'application/pdf', status_indexacao: 'processando', erro_indexacao: null, tamanho_bytes: 1310720, criado_em: ago(10 * MIN), atualizado_em: ago(10 * MIN) },
  makeMaterial({ campanha_id: id2, nome_original: 'revolucao-acreana-resumo.txt', mime_type: 'text/plain', status_indexacao: 'pronto', erro_indexacao: null, tamanho_bytes: 38000, criado_em: ago(1 * D) }),
  makeMaterial({ campanha_id: id2, nome_original: 'ciclo-da-borracha.pdf', mime_type: 'application/pdf', status_indexacao: 'pronto', erro_indexacao: null, tamanho_bytes: 4194304, criado_em: ago(1 * D) }),
];

const docs3: Material[] = [
  makeMaterial({ campanha_id: id3, nome_original: 'guia-horta-escolar.pdf', mime_type: 'application/pdf', status_indexacao: 'pronto', erro_indexacao: null, tamanho_bytes: 3355443, criado_em: ago(7 * D) }),
  makeMaterial({ campanha_id: id3, nome_original: 'fotos-canteiros-scan.pdf', mime_type: 'application/pdf', status_indexacao: 'erro', erro_indexacao: 'Não conseguimos ler o texto deste arquivo. Ele pode ser uma imagem escaneada ou estar protegido por senha.', tamanho_bytes: 8808038, criado_em: ago(7 * D) }),
];

const docs4: Material[] = [];

export const agentes: AgenteDetalhe[] = [
  {
    id: id1,
    nome: 'Matemática 9º ano',
    ativa: true,
    instrucoes: 'Papel: você é um tutor de Matemática que conversa por telefone com alunos do 9º ano.\n\nObjetivo: ajudar os alunos a revisar equações do 1º grau e porcentagem para o simulado.\n\nComo ensinar:\n- Quando o aluno pedir a resposta de um exercício, guie o raciocínio com perguntas em vez de entregar o resultado.\n- Explique um passo de cada vez e confira se o aluno entendeu antes de seguir.\n\nTom: acolhedor, paciente e encorajador.',
    criada_em: ago(5 * D),
    atualizada_em: ago(2 * D),
    docs: calcDocs(docs1),
    documentos: docs1,
  },
  {
    id: id2,
    nome: 'História do Acre',
    ativa: true,
    instrucoes: 'Quero que ajude os alunos do 6º e 7º ano a entender a Revolução Acreana e o ciclo da borracha, com exemplos da nossa região.',
    criada_em: ago(4 * D),
    atualizada_em: ago(10 * MIN),
    docs: calcDocs(docs2),
    documentos: docs2,
  },
  {
    id: id3,
    nome: 'Ciências da horta',
    ativa: false,
    instrucoes: 'Responder dúvidas das crianças do 1º ao 5º ano sobre plantas, solo e a horta da escola, com palavras simples.',
    criada_em: ago(10 * D),
    atualizada_em: ago(7 * D),
    docs: calcDocs(docs3),
    documentos: docs3,
  },
  {
    id: id4,
    nome: 'Inglês básico',
    ativa: false,
    instrucoes: null,
    criada_em: ago(3 * D),
    atualizada_em: ago(3 * D),
    docs: calcDocs(docs4),
    documentos: docs4,
  },
];

export { processingDocId };
