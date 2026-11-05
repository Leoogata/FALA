// src/services/tts.js — Text-to-Speech via ElevenLabs
//
// Dois tipos de armazenamento:
//
//   audioCache  — mensagens fixas pré-geradas no startup (permanentes, reutilizáveis)
//                 Ex: boas-vindas, retry STT, sem-rota, encerramento
//
//   audioStore  — respostas do agente geradas por turno (TTL 5min, one-shot)
//                 Ex: resposta educacional, mensagem sem_resposta
//
// Ambos são servidos por GET /audio/:id no próprio Express.
// Fallback: qualquer falha retorna null → twiml.js usa <Say voice="Polly.Camila">.
'use strict';

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// ─── Cache permanente (mensagens fixas) ──────────────────────────────────────
// Map<id, Buffer>  — sem TTL, sobrevive durante toda a vida do processo
const audioCache = new Map();

// ─── Store one-shot (respostas por turno) ────────────────────────────────────
// Map<id, { buffer: Buffer, expiraEm: number }>  — TTL 5min
const audioStore = new Map();
const AUDIO_TTL_MS = 5 * 60 * 1000;

// ─── Funções internas de armazenamento ───────────────────────────────────────

/**
 * Persiste um buffer no cache permanente com um ID fixo (determinístico).
 * Chamar com o mesmo chave substitui o buffer anterior.
 */
function salvarCache(chave, buffer) {
  audioCache.set(chave, buffer);
  return chave;
}

/**
 * Salva um buffer MP3 no store one-shot e retorna o ID de acesso.
 * Limpa entradas expiradas a cada gravação (limpeza lazy).
 */
function salvarAudio(buffer) {
  const agora = Date.now();
  for (const [id, entry] of audioStore) {
    if (entry.expiraEm < agora) audioStore.delete(id);
  }
  const id = crypto.randomBytes(16).toString('hex');
  audioStore.set(id, { buffer, expiraEm: agora + AUDIO_TTL_MS });
  return id;
}

/**
 * Recupera um buffer pelo ID — consulta primeiro o cache permanente,
 * depois o store one-shot (que consome a entrada).
 * Retorna null se não encontrar ou estiver expirado.
 */
function consumirAudio(id) {
  // Cache permanente — não consome, retorna direto
  if (audioCache.has(id)) return audioCache.get(id);

  // Store one-shot — consome
  const entry = audioStore.get(id);
  if (!entry) return null;
  audioStore.delete(id);
  if (entry.expiraEm < Date.now()) return null;
  return entry.buffer;
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────

/**
 * Gera áudio MP3 via ElevenLabs para o texto informado.
 *
 * @param {string} texto
 * @returns {Promise<Buffer>}
 * @throws se a API falhar ou as credenciais estiverem ausentes
 */
async function gerarAudioElevenLabs(texto) {
  if (!config.elevenLabsApiKey || !config.elevenLabsVoiceId) {
    throw new Error('ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID não configurados');
  }

  const response = await axios.post(
    `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(config.elevenLabsVoiceId)}`,
    {
      text: texto,
      model_id: 'eleven_multilingual_v2',
      // Naturalidade: stability baixo = mais variação/emoção (alto = monótono);
      // style realça expressividade; speaker_boost dá presença.
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.85,
        style: 0.4,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        'xi-api-key': config.elevenLabsApiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      // NOTA: para máxima naturalidade em telefonia, o ideal é entregar em
      // ulaw_8000 (evita o Twilio reamostrar 44.1kHz → 8kHz, que abafa a voz).
      // Isso exige o endpoint /audio servir como audio/basic ou .wav — ver nota
      // na conversa. Mantido MP3 por ora para não quebrar o <Play> existente.
      responseType: 'arraybuffer',
      timeout: config.ttsTimeoutMs,
    },
  );

  return Buffer.from(response.data);
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Converte texto em áudio via ElevenLabs e retorna uma URL one-shot.
 * Usada para respostas dinâmicas do agente (geradas por turno).
 *
 * Retorna null se qualquer etapa falhar — o caller usa <Say> como fallback.
 *
 * @param {string} texto
 * @returns {Promise<string|null>}
 */
async function textoParaAudioUrl(texto) {
  if (!config.publicUrl) {
    console.warn('[tts] PUBLIC_URL não configurada — fallback para Polly');
    return null;
  }

  try {
    const buffer = await gerarAudioElevenLabs(texto);
    const id = salvarAudio(buffer);
    const url = `${config.publicUrl.replace(/\/$/, '')}/audio/${id}`;
    console.info(`[tts] Áudio gerado: ${url} (${buffer.byteLength} bytes)`);
    return url;
  } catch (err) {
    console.warn(`[tts] Falha ao gerar áudio ElevenLabs: ${err.message}`);
    return null;
  }
}

/**
 * Retorna a URL permanente de uma mensagem fixa do cache.
 * Retorna null se a mensagem não foi pré-gerada (ElevenLabs indisponível no startup).
 *
 * @param {string} chave — chave da mensagem (ex: 'boasVindas', 'sttRetry')
 * @returns {string|null}
 */
function urlMensagemFixa(chave) {
  if (!config.publicUrl || !audioCache.has(chave)) return null;
  return `${config.publicUrl.replace(/\/$/, '')}/audio/${chave}`;
}

/**
 * Pré-gera os áudios de todas as mensagens fixas no startup.
 *
 * Deve ser chamado uma única vez antes de o servidor começar a receber chamadas.
 * Falhas individuais são logadas mas não interrompem o startup — o servidor
 * sobe mesmo assim e usa Polly como fallback para as mensagens não geradas.
 *
 * @param {Record<string, string>} mensagens — mapa chave → texto
 */
async function preAquecer(mensagens) {
  if (!config.elevenLabsApiKey || !config.elevenLabsVoiceId || !config.publicUrl) {
    console.warn('[tts] Pré-aquecimento ignorado — ElevenLabs ou PUBLIC_URL não configurados');
    return;
  }

  console.log('[tts] Pré-aquecendo mensagens fixas com ElevenLabs...');

  // Processamento em série — evita rate limit do ElevenLabs em planos com
  // limite de concorrência. Cada mensagem aguarda a anterior terminar.
  let falhas = 0;
  for (const [chave, texto] of Object.entries(mensagens)) {
    try {
      const buffer = await gerarAudioElevenLabs(texto);
      salvarCache(chave, buffer);
      console.log(`  ✓ ${chave} (${buffer.byteLength} bytes)`);
    } catch (err) {
      console.warn(`  ✗ ${chave}: ${err.message}`);
      falhas++;
    }
  }

  if (falhas > 0) {
    console.warn(`[tts] ${falhas} mensagem(ns) não gerada(s) — usando Polly como fallback para elas`);
  } else {
    console.log('[tts] Todas as mensagens fixas pré-geradas com sucesso.');
  }
}

module.exports = { textoParaAudioUrl, consumirAudio, urlMensagemFixa, preAquecer };
