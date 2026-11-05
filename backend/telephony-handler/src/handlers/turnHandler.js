// src/handlers/turnHandler.js — Handler POST /voice/turn
'use strict';

const { randomUUID } = require('crypto');
const config = require('../config');
const twiml = require('../services/twiml');
const tts = require('../services/tts');
const session = require('../services/callSession');
const orchestrator = require('../services/orchestrator');
const agentEducational = require('../services/agentEducational');
const campanhas = require('../services/campanhas');
const conversaClient = require('../services/conversaClient');
const { sanitizar } = require('../services/sanitizacao');

/**
 * POST /voice/turn
 * Processa o resultado do <Gather> e orquestra:
 *   1. Valida CallSid e recupera/inicializa conversa
 *   2. Validação STT (falha incrementa tentativas, não apaga histórico)
 *   3. Sanitiza pergunta e reserva turno no banco (idempotente por turno_token)
 *   4. Recupera contexto das trocas anteriores
 *   5. Roteamento com histórico
 *   6. Subagente educacional com histórico
 *   7. Finaliza turno com resultado confirmado no banco
 *   8. Retorna TwiML com novo token para próxima captura
 */
async function turnHandler(req, res) {
  const inicio = Date.now();
  const callSid = req.body.CallSid || '';
  const speechResult = req.body.SpeechResult || '';
  const rawConfidence = req.body.Confidence;
  const digits = req.body.Digits || '';
  // turno_token pode vir na query (URL de ação do Gather) ou no body
  const turnoTokenRecebido = req.query.turno_token || req.body.turno_token || null;

  const confidenceStt = rawConfidence !== undefined ? parseFloat(rawConfidence) : 0;

  // Rejeitar sem CallSid válido
  if (!callSid) {
    console.warn('[turn] Requisição sem CallSid — rejeitando');
    return res.status(400).type('text/xml').send('<Response><Hangup/></Response>');
  }

  // Recuperar ou criar conversa (proteção contra reinício do handler)
  let conversaId = session.getConversaId(callSid);
  if (!conversaId) {
    const { chave, versao } = session.calcularChaveChamada(callSid);
    try {
      const conversa = await conversaClient.criarOuRecuperarConversa({
        chaveChamada: chave,
        versaoChave: versao,
      });
      if (conversa.estado !== 'ATIVA') {
        return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
      }
      conversaId = conversa.conversa_id;
      session.setConversaId(callSid, conversaId);
    } catch (err) {
      console.error('[turn] Falha ao recuperar conversa:', err.message, { callSid: '[omitido]' });
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
  }

  // Aluno pressionou tecla → encerrar chamada
  if (digits && !speechResult) {
    try {
      await conversaClient.encerrarConversa(conversaId);
    } catch (_) { /* encerramento melhor-esforço */ }
    session.clearSession(callSid);
    return res.type('text/xml').send(twiml.buildHangupTwiml());
  }

  // ── Validação STT ──────────────────────────────────────────────────────────
  const hasValidSpeech = speechResult.trim().length > 0 && confidenceStt >= config.sttConfidenceThreshold;

  if (!hasValidSpeech) {
    // Incrementa somente tentativas — não apaga histórico
    const retries = session.incrementRetries(callSid);
    if (retries >= config.voiceMaxRetries) {
      try { await conversaClient.encerrarConversa(conversaId); } catch (_) {}
      session.clearSession(callSid);
      return res.type('text/xml').send(twiml.buildSttMaxRetriesTwiml());
    }
    // Reutilizar o mesmo token ou emitir novo para esta nova tentativa de captura
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildSttRetryTwiml(proximoToken));
  }

  // Fala válida — zerar somente tentativas, manter contexto
  session.resetRetries(callSid);

  // ── Determinar token deste turno ───────────────────────────────────────────
  // Preferir token recebido na URL (emitido na captura anterior)
  // Se não existir (ex: reinício), gerar novo
  const turnoToken = turnoTokenRecebido || session.getTurnoToken(callSid) || randomUUID();

  // ── Sanitização da pergunta ────────────────────────────────────────────────
  const { texto: perguntaSanitizada, suprimido } = sanitizar(speechResult);

  // ── Reserva do turno no banco ──────────────────────────────────────────────
  let interacaoId;
  let turnoJaExistia = false;
  let turnoJaConcluido = false;
  let mensagemRetornoSalva = null;
  try {
    const turno = await conversaClient.reservarTurno({
      conversaId,
      turnoToken,
      pergunta: perguntaSanitizada,
      textoSuprimido: suprimido,
    });
    interacaoId = turno.interacao_id;
    turnoJaExistia = turno.ja_existia;
    // turno já finalizado se concluida_em presente (ou status terminal)
    const statusTerminal = ['RESPONDIDO', 'ESCLARECIMENTO', 'SEM_ROTA', 'SEM_RESPOSTA', 'ERRO'];
    turnoJaConcluido = turnoJaExistia && (!!turno.concluida_em || statusTerminal.includes(turno.status));
    mensagemRetornoSalva = turno.mensagem_retorno ?? null;
  } catch (err) {
    console.error('[turn] Falha ao reservar turno:', err.message);
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  // Turno já CONCLUÍDO (retry de webhook após resposta salva): reproduzir o que foi gravado
  if (turnoJaConcluido) {
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    if (mensagemRetornoSalva) {
      return res.type('text/xml').send(twiml.buildAnswerTwiml(mensagemRetornoSalva, proximoToken));
    }
    return res.type('text/xml').send(twiml.buildNoAnswerTwiml(proximoToken));
  }

  // Turno reservado mas ainda em processamento (outra instância trabalhando)
  if (turnoJaExistia && !turnoJaConcluido) {
    // Retornar indisponibilidade controlada — não repetir processamento
    console.warn('[turn] Turno ainda em processamento — rejeitando requisição duplicada', { turnoToken });
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  // ── Recuperação de contexto ────────────────────────────────────────────────
  let historico = [];
  try {
    historico = await conversaClient.buscarContexto(conversaId);
  } catch (err) {
    // Falha na leitura de contexto — não processar silenciosamente como primeira pergunta
    console.error('[turn] Falha ao buscar contexto:', err.message);
    await _finalizarComErro({ conversaId, turnoToken, interacaoId, inicio });
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  // Pergunta para envio ao modelo (sanitizada ou indicação de supressão)
  const perguntaParaModelo = suprimido
    ? '[Texto suprimido por conteúdo não sanitizável]'
    : (perguntaSanitizada || '');

  // ── Roteamento ────────────────────────────────────────────────────────────
  // Cronômetro — mede quanto cada etapa demora (diagnóstico de latência)
  const t0 = Date.now();
  const ms = (desde) => `${Date.now() - desde}ms`;

  // --- Roteamento ---
  let routeResult;
  let campanhasAtivas = [];
  let campanhaRealId = null;

  const tRota = Date.now();
  try {
    campanhasAtivas = await campanhas.getCampanhasAtivas();
    routeResult = await orchestrator.routeQuestion({ pergunta: speechResult, campanhasAtivas });
    console.info(`[latencia] roteamento=${ms(tRota)}`, { callSid });
  } catch (err) {
    console.error('[turn] Erro no roteamento:', err.message);
    try {
      await _finalizarSemRota({ conversaId, turnoToken, inicio, mensagem: config.fallbackMessages.semRota });
    } catch (gravaErr) {
      console.error('[turn] Falha ao gravar sem_rota após erro de roteamento:', gravaErr.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildNoRouteTwiml(proximoToken));
  }

  const { campanhaId, confianca: confidenceOrchestrator, sem_rota, precisa_esclarecimento, pergunta_esclarecimento } = routeResult;

  // Resolver ID real da campanha no banco
  const campanhaAtiva = campanhasAtivas.find((c) => c.campanhaId === campanhaId);
  campanhaRealId = campanhaAtiva?.id ?? null;

  if (precisa_esclarecimento && pergunta_esclarecimento) {
    const { texto: esclarecimentoSanitizado, suprimido: esclarecimentoSuprimido } = sanitizar(pergunta_esclarecimento);
    // Se a sanitização suprimiu o texto, usar mensagem segura genérica em vez do texto original
    const textoEsclarecimento = esclarecimentoSuprimido
      ? config.fallbackMessages.semRota
      : (esclarecimentoSanitizado || config.fallbackMessages.semRota);
    try {
      await _finalizarEsclarecimento({
        conversaId, turnoToken, campanhaRealId, campanhaId,
        perguntaEsclarecimento: textoEsclarecimento,
        scoreConfiancaStt: confidenceStt,
        scoreConfiancaOrquestrador: confidenceOrchestrator,
        inicio,
      });
    } catch (err) {
      console.error('[turn] Falha ao gravar esclarecimento (orquestrador):', err.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildEsclarecimentoTwiml(textoEsclarecimento, proximoToken));
  }

  if (sem_rota || confidenceOrchestrator < config.orchestratorConfidenceThreshold) {
    try {
      await _finalizarSemRota({
        conversaId, turnoToken, campanhaRealId, campanhaId,
        scoreConfiancaStt: confidenceStt,
        scoreConfiancaOrquestrador: confidenceOrchestrator,
        inicio,
        mensagem: config.fallbackMessages.semRota,
      });
    } catch (err) {
      console.error('[turn] Falha ao gravar sem_rota:', err.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildNoRouteTwiml(proximoToken));
  }

  // ── Subagente educacional ─────────────────────────────────────────────────
  let agentResult;
  const tAgente = Date.now();
  try {
    agentResult = await agentEducational.answerQuestion({
      campanhaId,
      pergunta: perguntaParaModelo,
      historico,
    });
    agentResult = await agentEducational.answerQuestion({ campanhaId, pergunta: speechResult });
    console.info(`[latencia] subagente=${ms(tAgente)}`, { callSid });
  } catch (err) {
    console.error('[turn] Erro no subagente:', err.message);
    agentResult = { resposta: '', confianca: 0, sem_resposta: true, precisa_esclarecimento: false, pergunta_esclarecimento: '' };
  }

  const {
    resposta,
    confianca: confidenceAgent,
    sem_resposta,
    precisa_esclarecimento: agentePrecisaEsclarecimento,
    pergunta_esclarecimento: agentePerguntaEsclarecimento,
  } = agentResult;

  // ── Finalização confirmada no banco ───────────────────────────────────────
  const duracaoMs = Date.now() - inicio;

  if (agentePrecisaEsclarecimento && agentePerguntaEsclarecimento) {
    const { texto: mensagemSanitizada, suprimido: agenteEsclarecimentoSuprimido } = sanitizar(agentePerguntaEsclarecimento);
    // Se a sanitização suprimiu o texto, usar mensagem segura genérica em vez do texto original
    const textoEsclarecimentoAgente = agenteEsclarecimentoSuprimido
      ? config.fallbackMessages.semResposta
      : (mensagemSanitizada || config.fallbackMessages.semResposta);
    try {
      await _concluirTurno({
        conversaId, turnoToken, campanhaRealId, campanhaId,
        resposta: null,
        mensagemRetorno: textoEsclarecimentoAgente,
        status: 'ESCLARECIMENTO',
        textoSuprimido: false,
        semResposta: true,
        scoreConfiancaStt: confidenceStt,
        scoreConfiancaOrquestrador: confidenceOrchestrator,
        scoreConfiancaAgente: confidenceAgent,
        duracaoMs,
      });
    } catch (err) {
      console.error('[turn] Falha ao gravar esclarecimento (agente):', err.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildEsclarecimentoTwiml(textoEsclarecimentoAgente, proximoToken));
  }

  if (sem_resposta) {
    try {
      await _concluirTurno({
        conversaId, turnoToken, campanhaRealId, campanhaId,
        resposta: null,
        mensagemRetorno: config.fallbackMessages.semResposta,
        status: 'SEM_RESPOSTA',
        textoSuprimido: false,
        semResposta: true,
        scoreConfiancaStt: confidenceStt,
        scoreConfiancaOrquestrador: confidenceOrchestrator,
        scoreConfiancaAgente: confidenceAgent,
        duracaoMs,
      });
    } catch (err) {
      console.error('[turn] Falha ao gravar sem_resposta:', err.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    return res.type('text/xml').send(twiml.buildNoAnswerTwiml(proximoToken));
  }

  const { texto: respostaSanitizada, suprimido: respostaSuprimida } = sanitizar(resposta);
  const mensagemFinal = respostaSuprimida ? config.fallbackMessages.semResposta : (respostaSanitizada || config.fallbackMessages.semResposta);
  const statusFinal = respostaSuprimida ? 'SEM_RESPOSTA' : 'RESPONDIDO';

  try {
    await _concluirTurno({
      conversaId, turnoToken, campanhaRealId, campanhaId,
      resposta: respostaSuprimida ? null : respostaSanitizada,
      mensagemRetorno: mensagemFinal,
      status: statusFinal,
      textoSuprimido: respostaSuprimida,
      semResposta: respostaSuprimida,
      scoreConfiancaStt: confidenceStt,
      scoreConfiancaOrquestrador: confidenceOrchestrator,
      scoreConfiancaAgente: confidenceAgent,
      duracaoMs,
    });
  } catch (err) {
    console.error('[turn] Falha ao concluir turno:', err.message);
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  const proximoToken = randomUUID();
  session.setTurnoToken(callSid, proximoToken);
  return res.type('text/xml').send(twiml.buildAnswerTwiml(mensagemFinal, proximoToken));
}

// ── Helpers de finalização ─────────────────────────────────────────────────

async function _concluirTurno({
  conversaId, turnoToken, campanhaRealId, campanhaId,
  resposta, mensagemRetorno, status, textoSuprimido, semResposta,
  scoreConfiancaStt, scoreConfiancaOrquestrador, scoreConfiancaAgente, duracaoMs,
}) {
  // Re-lança sempre — chamador deve tratar e retornar indisponibilidade
  await conversaClient.concluirTurno({
    conversa_id: conversaId,
    turno_token: turnoToken,
    campanha_id: campanhaRealId ?? null,
    materia: campanhaId ?? null,
    resposta: resposta ?? null,
    mensagem_retorno: mensagemRetorno,
    status,
    texto_suprimido: textoSuprimido,
    sem_resposta: semResposta,
    score_confianca_stt: scoreConfiancaStt ?? null,
    score_confianca_orquestrador: scoreConfiancaOrquestrador ?? null,
    score_confianca_agente: scoreConfiancaAgente ?? null,
    duracao_ms: duracaoMs ?? null,
    versao_prompt: config.versaoPrompt ?? null,
  });
}

async function _finalizarComErro({ conversaId, turnoToken, inicio }) {
  const duracaoMs = Date.now() - inicio;
  try {
    await conversaClient.concluirTurno({
      conversa_id: conversaId,
      turno_token: turnoToken,
      campanha_id: null,
      materia: null,
      resposta: null,
      mensagem_retorno: '',
      status: 'ERRO',
      texto_suprimido: false,
      sem_resposta: false,
      duracao_ms: duracaoMs,
    });
  } catch (_) { /* melhor-esforço para erros internos */ }
}

// Lança em caso de falha — chamadores devem capturar e retornar indisponibilidade
async function _finalizarSemRota({ conversaId, turnoToken, campanhaRealId, campanhaId, scoreConfiancaStt, scoreConfiancaOrquestrador, inicio, mensagem }) {
  const duracaoMs = Date.now() - inicio;
  await conversaClient.concluirTurno({
    conversa_id: conversaId,
    turno_token: turnoToken,
    campanha_id: campanhaRealId ?? null,
    materia: campanhaId ?? null,
    resposta: null,
    mensagem_retorno: mensagem || '',
    status: 'SEM_ROTA',
    texto_suprimido: false,
    sem_resposta: false,
    score_confianca_stt: scoreConfiancaStt ?? null,
    score_confianca_orquestrador: scoreConfiancaOrquestrador ?? null,
    duracao_ms: duracaoMs,
  });
}

// Lança em caso de falha — chamadores devem capturar e retornar indisponibilidade
async function _finalizarEsclarecimento({ conversaId, turnoToken, campanhaRealId, campanhaId, perguntaEsclarecimento, scoreConfiancaStt, scoreConfiancaOrquestrador, inicio }) {
  const duracaoMs = Date.now() - inicio;
  await conversaClient.concluirTurno({
    conversa_id: conversaId,
    turno_token: turnoToken,
    campanha_id: campanhaRealId ?? null,
    materia: campanhaId ?? null,
    resposta: null,
    mensagem_retorno: perguntaEsclarecimento,
    status: 'ESCLARECIMENTO',
    texto_suprimido: false,
    sem_resposta: true,
    score_confianca_stt: scoreConfiancaStt ?? null,
    score_confianca_orquestrador: scoreConfiancaOrquestrador ?? null,
    duracao_ms: duracaoMs,
  });
  // --- Geração de áudio ElevenLabs (best-effort, fallback para Polly) ---
  const textoParaFalar = sem_resposta ? config.fallbackMessages.semResposta : resposta;
  const tTts = Date.now();
  const audioUrl = await tts.textoParaAudioUrl(textoParaFalar);
  console.info(`[latencia] tts=${ms(tTts)} | TOTAL=${ms(t0)}`, { callSid });

  if (audioUrl) {
    console.info(`[turn] TTS ElevenLabs OK: ${audioUrl}`, { callSid });
  } else {
    console.info('[turn] TTS ElevenLabs indisponível — usando Polly', { callSid });
  }

  // --- TwiML de resposta ---
  if (sem_resposta) {
    return res.type('text/xml').send(twiml.buildNoAnswerTwiml(audioUrl));
  }

  return res.type('text/xml').send(twiml.buildAnswerTwiml(resposta, audioUrl));
}

module.exports = turnHandler;
