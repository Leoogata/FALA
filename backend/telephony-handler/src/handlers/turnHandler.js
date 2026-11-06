// src/handlers/turnHandler.js — Handler POST /voice/turn
'use strict';

const { randomUUID } = require('crypto');
const config = require('../config');
const twiml = require('../services/twiml');
const tts = require('../services/tts');
const session = require('../services/callSession');
const agentEducational = require('../services/agentEducational');
const conversaClient = require('../services/conversaClient');
const { sanitizar } = require('../services/sanitizacao');

/**
 * POST /voice/turn
 * Processa o resultado do <Gather>:
 *   1. Valida CallSid e recupera/inicializa conversa
 *   2. Validação STT (falha incrementa tentativas, não apaga histórico)
 *   3. Sanitiza pergunta e reserva turno no banco (idempotente por turno_token)
 *   4. Solicita uma resposta ao backend usando a conversa persistida
 *   5. Finaliza turno com resultado confirmado no banco
 *   6. Retorna TwiML com novo token para próxima captura
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
        codigoEscola: session.getEscola(callSid),
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

  // Fala válida — zera só as tentativas, preservando contexto e escola da sessão
  session.resetRetries(callSid);

  // ── Determinar token deste turno ───────────────────────────────────────────
  // Preferir token recebido na URL (emitido na captura anterior)
  // Se não existir (ex: reinício), gerar novo
  const turnoToken = turnoTokenRecebido || session.getTurnoToken(callSid) || randomUUID();

  // ── Sanitização da pergunta ────────────────────────────────────────────────
  const { texto: perguntaSanitizada, suprimido } = sanitizar(speechResult);

  // ── Reserva do turno no banco ──────────────────────────────────────────────
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

  // O backend recupera a configuração persistida, o histórico e os documentos.
  // Uma única geração atende à pergunta, sem classificação de matéria.
  let agentResult;
  try {
    agentResult = await agentEducational.answerQuestion({ conversaId, turnoToken });
  } catch (err) {
    console.error('[turn] Falha ao gerar resposta:', err.message);
    await _finalizarComErro({ conversaId, turnoToken, inicio });
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }
  const campanhaRealId = agentResult.campanha_id ?? null;
  const fontes = agentResult.fontes ?? [];
  const versaoPrompt = agentResult.versao_prompt ?? config.versaoPrompt;

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
        conversaId, turnoToken, campanhaRealId, fontes, versaoPrompt,
        resposta: null,
        mensagemRetorno: textoEsclarecimentoAgente,
        status: 'ESCLARECIMENTO',
        textoSuprimido: false,
        semResposta: true,
        scoreConfiancaStt: confidenceStt,
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
        conversaId, turnoToken, campanhaRealId, fontes, versaoPrompt,
        resposta: null,
        mensagemRetorno: config.fallbackMessages.semResposta,
        status: 'SEM_RESPOSTA',
        textoSuprimido: false,
        semResposta: true,
        scoreConfiancaStt: confidenceStt,
        scoreConfiancaAgente: confidenceAgent,
        duracaoMs,
      });
    } catch (err) {
      console.error('[turn] Falha ao gravar sem_resposta:', err.message);
      return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
    }
    const proximoToken = randomUUID();
    session.setTurnoToken(callSid, proximoToken);
    const audioUrl = await gerarAudio(config.fallbackMessages.semResposta);
    return res.type('text/xml').send(twiml.buildNoAnswerTwiml(proximoToken, audioUrl));
  }

  const { texto: respostaSanitizada, suprimido: respostaSuprimida } = sanitizar(resposta);
  const mensagemFinal = respostaSuprimida ? config.fallbackMessages.semResposta : (respostaSanitizada || config.fallbackMessages.semResposta);
  const statusFinal = respostaSuprimida ? 'SEM_RESPOSTA' : 'RESPONDIDO';

  try {
    await _concluirTurno({
      conversaId, turnoToken, campanhaRealId, fontes, versaoPrompt,
      resposta: respostaSuprimida ? null : respostaSanitizada,
      mensagemRetorno: mensagemFinal,
      status: statusFinal,
      textoSuprimido: respostaSuprimida,
      semResposta: respostaSuprimida,
      scoreConfiancaStt: confidenceStt,
      scoreConfiancaAgente: confidenceAgent,
      duracaoMs,
    });
  } catch (err) {
    console.error('[turn] Falha ao concluir turno:', err.message);
    return res.type('text/xml').send(twiml.buildIndisponibilidadeTwiml());
  }

  const proximoToken = randomUUID();
  session.setTurnoToken(callSid, proximoToken);
  const audioUrl = await gerarAudio(mensagemFinal);
  return res.type('text/xml').send(twiml.buildAnswerTwiml(mensagemFinal, proximoToken, audioUrl));
}

// Falha na geração de áudio não altera o turno já persistido.
async function gerarAudio(texto) {
  try {
    return await tts.textoParaAudioUrl(texto) || null;
  } catch (_) {
    return null;
  }
}

// ── Helpers de finalização ─────────────────────────────────────────────────

async function _concluirTurno({
  conversaId, turnoToken, campanhaRealId, fontes, versaoPrompt,
  resposta, mensagemRetorno, status, textoSuprimido, semResposta,
  scoreConfiancaStt, scoreConfiancaAgente, duracaoMs,
}) {
  // Re-lança sempre — chamador deve tratar e retornar indisponibilidade
  await conversaClient.concluirTurno({
    conversa_id: conversaId,
    turno_token: turnoToken,
    campanha_id: campanhaRealId ?? null,
    materia: null,
    resposta: resposta ?? null,
    mensagem_retorno: mensagemRetorno,
    status,
    texto_suprimido: textoSuprimido,
    sem_resposta: semResposta,
    score_confianca_stt: scoreConfiancaStt ?? null,
    score_confianca_agente: scoreConfiancaAgente ?? null,
    duracao_ms: duracaoMs ?? null,
    versao_prompt: versaoPrompt ?? null,
    fontes,
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

module.exports = turnHandler;
