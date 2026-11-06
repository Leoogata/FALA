// src/controllers/conversas.controller.js — Controladores dos endpoints internos
import {
  upsertConversa,
  reservarTurno,
  concluirTurno,
  buscarContexto,
  encerrarConversa,
} from '../services/conversas.service.js';
import { createError } from '../middlewares/errorHandler.js';

/**
 * POST /internal/conversas
 * Cria ou recupera uma conversa pela chave HMAC.
 * Body: { chave_chamada, versao_chave }
 */
export async function postConversa(req, res, next) {
  try {
    const { chave_chamada, versao_chave, codigo_escola } = req.body;
    const conversa = await upsertConversa({ chaveChamada: chave_chamada, versaoChave: versao_chave,
      ...(codigo_escola !== undefined ? { codigoEscola: codigo_escola } : {}) });

    if (conversa.estado === 'EXPIRADA') {
      return next(createError(410, 'Conversa expirada'));
    }
    if (conversa.estado === 'ENCERRADA') {
      return next(createError(410, 'Conversa encerrada'));
    }

    return res.status(200).json({ conversa_id: conversa.id, estado: conversa.estado,
      escola_id: conversa.escolaId ?? null, agente_id: conversa.agenteId ?? null });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /internal/conversas/:id/contexto
 * Retorna as últimas trocas elegíveis para os agentes.
 */
export async function getContexto(req, res, next) {
  try {
    const { id } = req.params;
    const historico = await buscarContexto(id);
    return res.status(200).json({ historico });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /internal/conversas/:id/turnos
 * Reserva um turno na conversa.
 * Body: { turno_token, pergunta, texto_suprimido }
 */
export async function postTurno(req, res, next) {
  try {
    const { id: conversaId } = req.params;
    const { turno_token, pergunta, texto_suprimido } = req.body;

    const turno = await reservarTurno({
      conversaId,
      turnoToken: turno_token,
      perguntaSanitizada: pergunta ?? null,
      textoSuprimido: texto_suprimido ?? false,
    });

    const httpStatus = turno.jaExistia ? 200 : 201;
    return res.status(httpStatus).json({
      interacao_id: turno.id,
      ordem: turno.ordem,
      status: turno.status,
      mensagem_retorno: turno.mensagemRetorno ?? null,
      concluida_em: turno.concluida_em ?? null,
      ja_existia: turno.jaExistia,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /interacoes
 * Finaliza um turno com resultado do processamento.
 * Substitui o registro fire-and-forget do analytics.
 * Body: ConcluirTurnoSchema
 */
export async function postInteracao(req, res, next) {
  try {
    const {
      conversa_id,
      turno_token,
      campanha_id,
      materia,
      resposta,
      mensagem_retorno,
      status,
      texto_suprimido,
      sem_resposta,
      score_confianca_stt,
      score_confianca_orquestrador,
      score_confianca_agente,
      duracao_ms,
      versao_prompt,
    } = req.body;

    const resultado = await concluirTurno({
      turnoToken: turno_token,
      conversaId: conversa_id,
      campanhaId: campanha_id ?? null,
      materia: materia ?? null,
      resposta: resposta ?? null,
      mensagemRetorno: mensagem_retorno,
      status,
      textoSuprimido: texto_suprimido ?? false,
      semResposta: sem_resposta ?? false,
      scoreConfiancaStt: score_confianca_stt ?? null,
      scoreConfiancaOrquestrador: score_confianca_orquestrador ?? null,
      scoreConfiancaAgente: score_confianca_agente ?? null,
      duracaoMs: duracao_ms ?? null,
      versaoPrompt: versao_prompt ?? null,
      fontes: req.body.fontes ?? [],
    });

    return res.status(200).json(resultado);
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /internal/conversas/:id
 * Encerra uma conversa explicitamente.
 * Body: { estado: "ENCERRADA" }
 */
export async function patchConversa(req, res, next) {
  try {
    const { id } = req.params;
    await encerrarConversa(id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
