// src/repositories/conversas.repository.js — Persistência de Conversa e Interacao
import { randomUUID } from 'crypto';
import prisma from '../config/prisma.js';
import { selecionarAgente } from '../services/agentConfig.service.js';

const RETENTION_HOURS = 168;
const CONTEXT_MAX_TURNS = 5;
const CONTEXT_MAX_CHARS = 8000;

/** Duração do lease de processamento de turno em ms (2 minutos) */
const LEASE_DURATION_MS = 2 * 60 * 1000;

/** Código Prisma para conflito de serialização */
const PRISMA_SERIALIZATION_ERROR = 'P2034';

/** Máximo de tentativas em caso de conflito de serialização */
const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Executa fn com retries automáticos em conflitos de serialização (P2034).
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function comRetrySerializacao(fn) {
  let tentativa = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      tentativa++;
      if (err?.code === PRISMA_SERIALIZATION_ERROR && tentativa < MAX_SERIALIZATION_RETRIES) {
        // Espera exponencial curta antes de repetir: 50ms, 100ms
        await new Promise((resolve) => setTimeout(resolve, 50 * tentativa));
        continue;
      }
      throw err;
    }
  }
}

/** @returns {Date} now + 168 h in UTC */
function expiresAt(from = new Date()) {
  return new Date(from.getTime() + RETENTION_HOURS * 60 * 60 * 1000);
}

/**
 * Cria ou recupera uma conversa pela chave HMAC.
 * Idempotente: chamadas repetidas com a mesma chave retornam o mesmo registro.
 *
 * @param {{ chaveChamada: string, versaoChave: string }} params
 * @returns {Promise<{ id: string, estado: string }>}
 */
export async function upsertConversa({ chaveChamada, versaoChave, codigoEscola }) {
  const existente = await prisma.conversa.findUnique({ where: { chave_chamada: chaveChamada } });
  if (existente) return existente;
  const agente = await selecionarAgente(codigoEscola);
  const agora = new Date();
  const expira = expiresAt(agora);

  const conversa = await prisma.conversa.upsert({
    where: { chave_chamada: chaveChamada },
    create: {
      chave_chamada: chaveChamada,
      versao_chave: versaoChave,
      escolaId: agente.escolaId,
      agenteId: agente.id,
      instrucoesAgente: agente.descricao,
      estado: 'ATIVA',
      criada_em: agora,
      ultima_atividade_em: agora,
      expira_em: expira,
    },
    update: {
      // Na recuperação, não reabrir conversa encerrada/expirada — só atualizar ATIVA
      ultima_atividade_em: agora,
    },
    select: { id: true, estado: true, expira_em: true, escolaId: true, agenteId: true },
  });

  return conversa;
}

/**
 * Reserva um turno (interação) de forma atômica, com atribuição ordenada e idempotência.
 * Retorna o registro existente se o turno_token já existir.
 *
 * @param {{ conversaId: string, turnoToken: string, perguntaSanitizada: string|null, textoSuprimido: boolean }} params
 * @returns {Promise<{ id: string, ordem: number, status: string, jaExistia: boolean }>}
 */
export async function reservarTurno({ conversaId, turnoToken, perguntaSanitizada, textoSuprimido,
  classificacaoStatus, materiaClassificada, classificacaoVersao }) {
  return comRetrySerializacao(async () => {
    const agora = new Date();
    const execucaoId = randomUUID();
    const leaseExpiraEm = new Date(agora.getTime() + LEASE_DURATION_MS);

    // Toda a lógica em uma transação serializable para evitar corrida na ordem
    const resultado = await prisma.$transaction(async (tx) => {
      // Verificar estado da conversa antes de qualquer coisa
      const conversa = await tx.conversa.findUnique({
        where: { id: conversaId },
        select: { estado: true, expira_em: true },
      });

      if (!conversa) throw Object.assign(new Error('Conversa não encontrada'), { status: 404 });
      if (conversa.estado === 'ENCERRADA') throw Object.assign(new Error('Conversa encerrada'), { status: 410 });
      if (conversa.estado === 'EXPIRADA' || conversa.expira_em <= agora) {
        throw Object.assign(new Error('Conversa expirada'), { status: 410 });
      }

      // Idempotência: token já existe → verificar lease e estado
      const existente = await tx.interacao.findUnique({
        where: { turno_token: turnoToken },
        select: {
          id: true, conversa_id: true, ordem: true, status: true,
          mensagem_retorno: true, concluida_em: true, pergunta: true,
          execucao_id: true, lease_expira_em: true,
        },
      });

      if (existente) {
        // Rejeitar se token pertence a outra conversa
        if (existente.conversa_id !== conversaId) {
          throw Object.assign(new Error('Token não pertence a esta conversa'), { status: 409 });
        }
        // Rejeitar se conteúdo difere do que foi salvo (evitar adulteração)
        const perguntaNova = perguntaSanitizada ?? null;
        if (existente.pergunta !== null && perguntaNova !== null && existente.pergunta !== perguntaNova) {
          throw Object.assign(new Error('Conteúdo do turno não pode ser alterado'), { status: 409 });
        }

        // Turno já finalizado → retornar para reprodução idempotente
        if (existente.concluida_em !== null) {
          return {
            id: existente.id,
            ordem: existente.ordem,
            status: existente.status,
            mensagemRetorno: existente.mensagem_retorno,
            concluida_em: existente.concluida_em,
            jaExistia: true,
          };
        }

        // Lease expirado → turno abandonado, assumir processamento
        const leaseExpirado = !existente.lease_expira_em || existente.lease_expira_em <= agora;
        if (leaseExpirado) {
          await tx.interacao.update({
            where: { id: existente.id },
            data: { execucao_id: execucaoId, lease_expira_em: leaseExpiraEm },
          });
          return {
            id: existente.id,
            ordem: existente.ordem,
            status: existente.status,
            mensagemRetorno: null,
            concluida_em: null,
            jaExistia: false, // tratar como novo: reprocessar
          };
        }

        // Lease ainda válido → outra instância está processando
        return {
          id: existente.id,
          ordem: existente.ordem,
          status: existente.status,
          mensagemRetorno: existente.mensagem_retorno,
          concluida_em: existente.concluida_em,
          jaExistia: true,
        };
      }

      const expira = expiresAt(agora);

      // Atribuição de ordem atômica dentro desta transação
      const ultima = await tx.interacao.findFirst({
        where: { conversa_id: conversaId },
        orderBy: { ordem: 'desc' },
        select: { ordem: true },
      });
      const novaOrdem = (ultima?.ordem ?? 0) + 1;

      const interacao = await tx.interacao.create({
        data: {
          conversa_id: conversaId,
          turno_token: turnoToken,
          ordem: novaOrdem,
          pergunta: perguntaSanitizada ?? null,
          texto_suprimido: textoSuprimido,
          status: 'RECEBIDO',
          recebida_em: agora,
          expira_em: expira,
          execucao_id: execucaoId,
          lease_expira_em: leaseExpiraEm,
          classificacao_status: classificacaoStatus ?? null,
          materia_classificada: materiaClassificada ?? null,
          classificacao_versao: classificacaoVersao ?? null,
        },
        select: { id: true, ordem: true, status: true },
      });

      return { ...interacao, mensagemRetorno: null, concluida_em: null, jaExistia: false };
    }, {
      isolationLevel: 'Serializable',
    });

    return resultado;
  });
}

/**
 * Finaliza um turno com o resultado do processamento.
 * Idempotente: turno já finalizado retorna os dados salvos sem alterar.
 * Só o proprietário do lease (identificado por turnoToken + conversaId) pode finalizar.
 *
 * @param {{
 *   turnoToken: string,
 *   conversaId: string,
 *   campanhaId: string|null,
 *   materia: string|null,
 *   resposta: string|null,
 *   mensagemRetorno: string,
 *   status: string,
 *   textoSuprimido: boolean,
 *   semResposta: boolean,
 *   scoreConfiancaStt: number|null,
 *   scoreConfiancaOrquestrador: number|null,
 *   scoreConfiancaAgente: number|null,
 *   duracaoMs: number|null,
 *   versaoPrompt: string|null,
 * }} params
 * @returns {Promise<{ id: string, status: string }>}
 */
export async function concluirTurno({
  turnoToken,
  conversaId,
  campanhaId,
  materia,
  resposta,
  mensagemRetorno,
  status,
  textoSuprimido,
  semResposta,
  scoreConfiancaStt,
  scoreConfiancaOrquestrador,
  scoreConfiancaAgente,
  duracaoMs,
  versaoPrompt,
  fontes,
}) {
  const agora = new Date();

  const resultado = await prisma.$transaction(async (tx) => {
    const interacao = await tx.interacao.findUnique({
      where: { turno_token: turnoToken },
      select: { id: true, conversa_id: true, status: true, concluida_em: true },
    });

    if (!interacao) throw Object.assign(new Error('Turno não encontrado'), { status: 404 });
    if (interacao.conversa_id !== conversaId) {
      throw Object.assign(new Error('Token não pertence a esta conversa'), { status: 409 });
    }

    // Idempotência: já finalizado → retorna sem gravar novamente
    const finalStatuses = ['RESPONDIDO', 'ESCLARECIMENTO', 'SEM_ROTA', 'SEM_RESPOSTA', 'ERRO'];
    if (finalStatuses.includes(interacao.status)) {
      return { id: interacao.id, status: interacao.status };
    }

    const updated = await tx.interacao.update({
      where: { id: interacao.id },
      data: {
        campanha_id: campanhaId ?? null,
        materia: materia ?? null,
        resposta: resposta ?? null,
        mensagem_retorno: mensagemRetorno,
        status,
        texto_suprimido: textoSuprimido,
        sem_resposta: semResposta,
        score_confianca_stt: scoreConfiancaStt ?? null,
        score_confianca_orquestrador: scoreConfiancaOrquestrador ?? null,
        score_confianca_agente: scoreConfiancaAgente ?? null,
        duracao_ms: duracaoMs ?? null,
        versao_prompt: versaoPrompt ?? null,
        fontes: fontes ?? [],
        concluida_em: agora,
      },
      select: { id: true, status: true },
    });

    // Atualiza metadados da conversa (sem alterar expira_em dos turnos anteriores)
    const novaExpiracao = expiresAt(agora);
    await tx.conversa.update({
      where: { id: conversaId },
      data: {
        ultima_atividade_em: agora,
        expira_em: novaExpiracao,
      },
    });

    return updated;
  });

  return resultado;
}

/**
 * Recupera o contexto das últimas trocas elegíveis para os agentes.
 * Inclui somente status RESPONDIDO e ESCLARECIMENTO, não vencidos.
 * Limita a CONTEXT_MAX_TURNS trocas e CONTEXT_MAX_CHARS caracteres total.
 *
 * @param {string} conversaId
 * @returns {Promise<Array<{ pergunta: string, resposta: string, materia: string|null, status: string }>>}
 */
export async function buscarContexto(conversaId) {
  const agora = new Date();

  const turnos = await prisma.interacao.findMany({
    where: {
      conversa_id: conversaId,
      status: { in: ['RESPONDIDO', 'ESCLARECIMENTO'] },
      texto_suprimido: false,
      expira_em: { gt: agora },
    },
    orderBy: { ordem: 'asc' },
    select: {
      pergunta: true,
      mensagem_retorno: true,
      resposta: true,
      materia: true,
      status: true,
    },
  });

  // Pegar as últimas N trocas
  const ultimas = turnos.slice(-CONTEXT_MAX_TURNS);

  // Aplicar limite de caracteres — remover trocas mais antigas inteiras
  let total = 0;
  const elegíveis = [];
  for (let i = ultimas.length - 1; i >= 0; i--) {
    const t = ultimas[i];
    const respostaTexto = t.resposta || t.mensagem_retorno || '';
    const chars = (t.pergunta?.length ?? 0) + respostaTexto.length;
    if (total + chars > CONTEXT_MAX_CHARS) break;
    total += chars;
    elegíveis.unshift(t);
  }

  return elegíveis.map((t) => ({
    pergunta: t.pergunta ?? '',
    resposta: t.resposta || t.mensagem_retorno || '',
    materia: t.materia ?? null,
    status: t.status,
  }));
}

/**
 * Encerra explicitamente uma conversa.
 * Não apaga interações — elas permanecem até expira_em.
 *
 * @param {string} conversaId
 * @returns {Promise<void>}
 */
export async function encerrarConversa(conversaId) {
  await prisma.conversa.update({
    where: { id: conversaId },
    data: {
      estado: 'ENCERRADA',
      encerrada_em: new Date(),
    },
  });
}

/**
 * Expurgo de retenção: remove interações e conversas vencidas.
 * Executa em lotes de até 1.000 para não sobrecarregar o banco.
 *
 * @returns {Promise<{ interacoesRemovidas: number, conversasRemovidas: number, duracaoMs: number }>}
 */
export async function expurgarVencidos() {
  const inicio = Date.now();
  const agora = new Date();
  let interacoesRemovidas = 0;
  let conversasRemovidas = 0;

  // 1. Remover interações vencidas em lotes, do mais antigo para o mais recente
  let continuar = true;
  while (continuar) {
    const lote = await prisma.interacao.findMany({
      where: { expira_em: { lte: agora } },
      orderBy: { expira_em: 'asc' },
      take: 1000,
      select: { id: true },
    });
    if (lote.length === 0) { continuar = false; break; }
    const ids = lote.map((i) => i.id);
    await prisma.interacao.deleteMany({ where: { id: { in: ids } } });
    interacoesRemovidas += lote.length;
    if (lote.length < 1000) continuar = false;
  }

  // 2. Remover conversas vencidas sem interações válidas restantes
  continuar = true;
  while (continuar) {
    const lote = await prisma.conversa.findMany({
      where: {
        expira_em: { lte: agora },
        interacoes: { none: { expira_em: { gt: agora } } },
      },
      take: 1000,
      select: { id: true },
    });
    if (lote.length === 0) { continuar = false; break; }
    const ids = lote.map((c) => c.id);
    await prisma.conversa.deleteMany({ where: { id: { in: ids } } });
    conversasRemovidas += lote.length;
    if (lote.length < 1000) continuar = false;
  }

  const duracaoMs = Date.now() - inicio;
  return { interacoesRemovidas, conversasRemovidas, duracaoMs };
}

/**
 * Encerra conversas ATIVAS que não recebem atividade há mais de `inactividadeMinutos` minutos.
 * Executa em lote de até 500 por ciclo.
 *
 * @param {number} inactividadeMinutos
 * @returns {Promise<{ encerradas: number }>}
 */
export async function encerrarConversasInativas(inactividadeMinutos) {
  const agora = new Date();
  const limiteInatividade = new Date(agora.getTime() - inactividadeMinutos * 60 * 1000);

  const lote = await prisma.conversa.findMany({
    where: {
      estado: 'ATIVA',
      ultima_atividade_em: { lt: limiteInatividade },
    },
    take: 500,
    select: { id: true },
  });

  if (lote.length === 0) return { encerradas: 0 };

  const ids = lote.map((c) => c.id);
  await prisma.conversa.updateMany({
    where: { id: { in: ids } },
    data: { estado: 'ENCERRADA', encerrada_em: agora },
  });

  return { encerradas: lote.length };
}
