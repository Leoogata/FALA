// ─── Escola fictícia ────────────────────────────────────────────────────────
export const ESCOLA = {
  nome: 'E.E. Profª Raimunda Nonata',
  municipio: 'Xapuri',
  uf: 'AC',
  codigo: 4821,
};
export const TELEFONE_0800 = '0800 000 0000';

// ─── Upload ──────────────────────────────────────────────────────────────────
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const UPLOAD_EXTENSOES = ['.pdf', '.txt'];
export const UPLOAD_MIME = ['application/pdf', 'text/plain'];
export const UPLOAD_PARALELOS = 3;

// ─── Validações de campos ────────────────────────────────────────────────────
export const NOME_MIN = 3;
export const NOME_MAX = 60;
export const INSTRUCOES_MIN = 20;
export const INSTRUCOES_MAX = 4000;

// ─── Polling e timeouts ──────────────────────────────────────────────────────
export const POLLING_DOCUMENTOS_MS = 3000;
export const POLLING_LISTA_MS = 5000;
export const TIMEOUT_PADRAO_MS = 15000;
export const TIMEOUT_IA_MS = 30000;

// ─── Regras fixas da Ponte ───────────────────────────────────────────────────
export const REGRAS_FIXAS = [
  'Respostas curtas, em frases simples, pensadas para serem ouvidas (sem listas, tabelas, links ou símbolos).',
  'Responder apenas com base nos materiais enviados pela escola.',
  'Quando não souber, dizer isso com honestidade e orientar o aluno a procurar o professor.',
  'Nunca pedir nem repetir nome, telefone, endereço ou outros dados pessoais.',
  'Linguagem e conteúdo adequados para crianças e adolescentes.',
];

// ─── Textos da ligação ───────────────────────────────────────────────────────
export const TEXTOS_LIGACAO = {
  saudacao: 'Olá! Aqui é a Ponte, seu apoio nos estudos.',
  menu: 'Você pode estudar {lista}. Qual você quer?',
  semAgentes: 'No momento, não há agentes disponíveis. Tente de novo mais tarde. Tchau!',
  escolha: 'Combinado! Agora você está estudando {nome}. Pode fazer sua pergunta.',
};
