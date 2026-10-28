import type {
  AgenteResumo,
  AgenteDetalhe,
  Material,
  RespostaMelhorar,
  RespostaTestar,
  RespostaRemoverMaterial,
} from '../api/types';
import { ApiError } from '../api/types';
import { agentes, calcDocs, processingDocId } from './data';
import {
  NOME_MIN,
  NOME_MAX,
  INSTRUCOES_MIN,
  INSTRUCOES_MAX,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME,
} from '../config';

// ─── Latência simulada ────────────────────────────────────────────────────────
function delay(min = 300, max = 800): Promise<void> {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));
}

function delayIA(): Promise<void> {
  return new Promise((r) => setTimeout(r, 1500));
}

// ─── Normalização de texto para comparação ────────────────────────────────────
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ─── Auto-processamento do material inicial de História do Acre ───────────────
let initialProcessingDone = false;
function scheduleInitialProcessing() {
  if (initialProcessingDone) return;
  initialProcessingDone = true;
  const ms = 2000 + Math.random() * 2000;
  setTimeout(() => {
    for (const ag of agentes) {
      const doc = ag.documentos.find((d) => d.id === processingDocId);
      if (doc) {
        doc.status_indexacao = 'pronto';
        doc.atualizado_em = new Date().toISOString();
        ag.docs = calcDocs(ag.documentos);
        ag.atualizada_em = new Date().toISOString();
      }
    }
  }, ms);
}
scheduleInitialProcessing();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function findAgente(id: string): AgenteDetalhe {
  const a = agentes.find((ag) => ag.id === id);
  if (!a) throw new ApiError(404, 'nao_encontrado', 'Agente não encontrado.');
  return a;
}

function toResumo(a: AgenteDetalhe): AgenteResumo {
  return {
    id: a.id,
    nome: a.nome,
    ativa: a.ativa,
    criada_em: a.criada_em,
    atualizada_em: a.atualizada_em,
    docs: a.docs,
  };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export async function mockListarAgentes(filtro?: { ativa?: boolean }): Promise<AgenteResumo[]> {
  await delay();
  let lista = agentes.map(toResumo);
  if (filtro?.ativa !== undefined) {
    lista = lista.filter((a) => a.ativa === filtro.ativa);
  }
  return lista.slice().sort(
    (a, b) => new Date(b.atualizada_em).getTime() - new Date(a.atualizada_em).getTime(),
  );
}

export async function mockCriarAgente(nome: string): Promise<AgenteDetalhe> {
  await delay();
  // Validação
  if (!nome || nome.trim().length === 0) throw new ApiError(422, 'validacao', 'Dê um nome para o agente.');
  if (nome.trim().length < NOME_MIN) throw new ApiError(422, 'validacao', `Use pelo menos ${NOME_MIN} caracteres.`);
  if (nome.trim().length > NOME_MAX) throw new ApiError(422, 'validacao', `O nome pode ter no máximo ${NOME_MAX} caracteres.`);
  const norm = normalize(nome);
  if (agentes.some((a) => normalize(a.nome) === norm)) {
    throw new ApiError(422, 'validacao', 'Já existe um agente com esse nome. Na ligação, o aluno não conseguiria diferenciar os dois.');
  }
  const now = new Date().toISOString();
  const novo: AgenteDetalhe = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    ativa: false,
    instrucoes: null,
    criada_em: now,
    atualizada_em: now,
    docs: { pronto: 0, processando: 0, erro: 0 },
    documentos: [],
  };
  agentes.push(novo);
  return novo;
}

export async function mockBuscarAgente(id: string): Promise<AgenteDetalhe> {
  await delay();
  return JSON.parse(JSON.stringify(findAgente(id))) as AgenteDetalhe;
}

export async function mockAtualizarAgente(
  id: string,
  dados: Partial<{ nome: string; instrucoes: string; ativa: boolean }>,
): Promise<AgenteDetalhe> {
  await delay();
  const ag = findAgente(id);

  if (dados.nome !== undefined) {
    const n = dados.nome.trim();
    if (n.length < NOME_MIN) throw new ApiError(422, 'validacao', `Use pelo menos ${NOME_MIN} caracteres.`);
    if (n.length > NOME_MAX) throw new ApiError(422, 'validacao', `O nome pode ter no máximo ${NOME_MAX} caracteres.`);
    const norm = normalize(n);
    if (agentes.some((a) => a.id !== id && normalize(a.nome) === norm)) {
      throw new ApiError(422, 'validacao', 'Já existe um agente com esse nome. Na ligação, o aluno não conseguiria diferenciar os dois.');
    }
    ag.nome = n;
  }

  if (dados.instrucoes !== undefined) {
    const instr = dados.instrucoes.trim();
    if (instr.length < INSTRUCOES_MIN) throw new ApiError(422, 'validacao', `Descreva com pelo menos ${INSTRUCOES_MIN} caracteres o que o agente deve fazer.`);
    if (instr.length > INSTRUCOES_MAX) throw new ApiError(422, 'validacao', `As instruções podem ter no máximo ${INSTRUCOES_MAX} caracteres.`);
    ag.instrucoes = instr;
  }

  if (dados.ativa === true) {
    if (ag.docs.pronto === 0) throw new ApiError(422, 'sem_material_pronto', 'Envie pelo menos um material antes de ativar.');
    if (!ag.instrucoes) throw new ApiError(422, 'sem_instrucoes', 'Escreva as instruções do agente antes de ativar.');
    ag.ativa = true;
  } else if (dados.ativa === false) {
    ag.ativa = false;
  }

  ag.atualizada_em = new Date().toISOString();
  return JSON.parse(JSON.stringify(ag)) as AgenteDetalhe;
}

export async function mockListarMateriais(agenteId: string): Promise<Material[]> {
  await delay(200, 400);
  const ag = findAgente(agenteId);
  return JSON.parse(JSON.stringify(ag.documentos)) as Material[];
}

export async function mockEnviarMaterial(
  agenteId: string,
  arquivo: File,
  onProgress: (pct: number) => void,
): Promise<Material> {
  const ag = findAgente(agenteId);

  // Validações
  if (!UPLOAD_MIME.includes(arquivo.type)) {
    throw new ApiError(415, 'formato_invalido', `"${arquivo.name}": envie PDF ou TXT.`);
  }
  if (arquivo.size > UPLOAD_MAX_BYTES) {
    throw new ApiError(413, 'arquivo_grande', `"${arquivo.name}": o limite é 10 MB.`);
  }
  if (ag.documentos.some((d) => d.nome_original === arquivo.name)) {
    throw new ApiError(409, 'arquivo_duplicado', `"${arquivo.name}" já foi enviado para este agente.`);
  }

  // Simula progresso
  for (let p = 0; p <= 100; p += 20) {
    await new Promise((r) => setTimeout(r, 80));
    onProgress(p);
  }

  const now = new Date().toISOString();
  const doc: Material = {
    id: crypto.randomUUID(),
    campanha_id: agenteId,
    nome_original: arquivo.name,
    mime_type: arquivo.type as 'application/pdf' | 'text/plain',
    status_indexacao: 'processando',
    erro_indexacao: null,
    tamanho_bytes: arquivo.size,
    criado_em: now,
    atualizado_em: now,
  };

  ag.documentos.unshift(doc);
  ag.docs = calcDocs(ag.documentos);
  ag.atualizada_em = now;

  // Simula processamento
  const nameLC = arquivo.name.toLowerCase();
  const willError = nameLC.includes('erro') || nameLC.includes('scan');
  const ms = 2000 + Math.random() * 2000;

  setTimeout(() => {
    const found = ag.documentos.find((d) => d.id === doc.id);
    if (!found) return;
    if (willError) {
      found.status_indexacao = 'erro';
      found.erro_indexacao = 'Não conseguimos ler o texto deste arquivo. Ele pode ser uma imagem escaneada ou estar protegido por senha.';
    } else {
      found.status_indexacao = 'pronto';
    }
    found.atualizado_em = new Date().toISOString();
    ag.docs = calcDocs(ag.documentos);
    ag.atualizada_em = new Date().toISOString();
  }, ms);

  return JSON.parse(JSON.stringify(doc)) as Material;
}

export async function mockRemoverMaterial(
  agenteId: string,
  docId: string,
): Promise<RespostaRemoverMaterial> {
  await delay();
  const ag = findAgente(agenteId);
  const idx = ag.documentos.findIndex((d) => d.id === docId);
  if (idx === -1) throw new ApiError(404, 'nao_encontrado', 'Este material já foi removido.');
  ag.documentos.splice(idx, 1);
  ag.docs = calcDocs(ag.documentos);
  // Se estava ativo e ficou sem material pronto, desativa
  if (ag.ativa && ag.docs.pronto === 0) {
    ag.ativa = false;
  }
  ag.atualizada_em = new Date().toISOString();
  return { campanha_ativa: ag.ativa };
}

export async function mockMelhorarInstrucoes(
  nome: string,
  instrucoes: string,
): Promise<RespostaMelhorar> {
  await delayIA();
  return {
    texto_sugerido: `Papel: você é um tutor de ${nome} que conversa por telefone com alunos.\n\nObjetivo: ${instrucoes.slice(0, 80).trim()}.\n\nComo ensinar:\n- Use linguagem simples e exemplos do dia a dia.\n- Confirme o entendimento do aluno antes de avançar.\n- Se o aluno perguntar algo fora do conteúdo, oriente-o a procurar o professor.\n\nTom: acolhedor, paciente e encorajador. Fale em frases curtas.`,
    mudancas: [
      'Definiu o papel do agente e o público-alvo.',
      'Definiu o tom de voz (acolhedor, paciente).',
      'Adicionou instrução sobre como lidar com dúvidas fora do conteúdo.',
      'Adaptou o texto para ser ouvido por telefone.',
    ],
    premissas: [
      'Que o agente não deve dar respostas prontas de exercícios.',
      'Que o público-alvo são alunos do ensino fundamental ou médio.',
    ],
  };
}

export async function mockTestarAgente(
  agenteId: string,
  pergunta: string,
): Promise<RespostaTestar> {
  await delayIA();
  const ag = findAgente(agenteId);

  if (ag.docs.pronto === 0) {
    return {
      resposta: 'Ainda não tenho materiais para responder. Peça ao professor para enviar os materiais do agente.',
      confianca: 0,
      sem_resposta: true,
    };
  }

  // Heurística: verifica palavras com 5+ letras em comum com o nome do agente ou materiais
  const words5 = pergunta
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 5);
  const context = [
    ag.nome,
    ...ag.documentos.map((d) => d.nome_original),
  ].join(' ').toLowerCase();
  const hasMatch = words5.some((w) => context.includes(w));

  if (!hasMatch) {
    return {
      resposta: 'Não encontrei essa informação nos materiais disponíveis. Para essa dúvida, procure seu professor.',
      confianca: 0,
      sem_resposta: true,
    };
  }

  return {
    resposta: `Com base nos materiais de ${ag.nome}, posso dizer que este é um tema importante do conteúdo. Recomendo revisar os arquivos enviados pelo professor para entender melhor.`,
    confianca: 0.84,
    sem_resposta: false,
  };
}
