// src/config.js — Variáveis de ambiente e valores padrão
'use strict';

require('dotenv').config();

module.exports = {
  // Twilio
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',

  // Limites de voz
  sttConfidenceThreshold: parseFloat(process.env.TWILIO_STT_CONFIDENCE_THRESHOLD || '0.6'),
  voiceMaxRetries: parseInt(process.env.VOICE_MAX_RETRIES || '2', 10),

  // watsonx
  watsonxApiKey: process.env.WATSONX_API_KEY || '',
  watsonxProjectId: process.env.WATSONX_PROJECT_ID || '',
  watsonxOrchestratorId: process.env.WATSONX_AGENT_ORCHESTRATOR_ID || '',
  orchestratorConfidenceThreshold: parseFloat(process.env.ORCHESTRATOR_CONFIDENCE_THRESHOLD || '0.5'),

  // Mapeamento campanhaId → agentId
  watsonxAgentIds: {
    historia: process.env.WATSONX_AGENT_ID_HISTORIA || '',
    geografia: process.env.WATSONX_AGENT_ID_GEOGRAFIA || '',
    portugues: process.env.WATSONX_AGENT_ID_PORTUGUES || '',
    matematica: process.env.WATSONX_AGENT_ID_MATEMATICA || '',
    ciencias: process.env.WATSONX_AGENT_ID_CIENCIAS || '',
  },

  // URLs de outros serviços
  backendApiUrl: process.env.BACKEND_API_URL || '',
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL || '',
  // URL pública do próprio servidor (ngrok/CF tunnel/produção)
  // Necessária para gerar URLs de áudio acessíveis pelo Twilio via <Play>
  // Ex: https://abc123.ngrok.io  ou  https://fala.seudominio.com
  publicUrl: process.env.PUBLIC_URL || '',

  // RAG — context injection
  ragInternalToken: process.env.RAG_INTERNAL_TOKEN || '',
  ragTimeoutMs: parseInt(process.env.RAG_TIMEOUT_MS || '800', 10),

  // ElevenLabs TTS
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  // Voice ID do painel ElevenLabs — default: "Rachel" (pt-BR compatível)
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  // Timeout total para geração de áudio + upload (ms)
  ttsTimeoutMs: parseInt(process.env.TTS_TIMEOUT_MS || '8000', 10),

  // Mensagens de fallback configuráveis
  fallbackMessages: {
    semResposta: process.env.FALLBACK_MSG_SEM_RESPOSTA
      || 'Ainda não tenho o conteúdo dessa matéria disponível. Consulte seu professor para mais detalhes.',
    semRota: process.env.FALLBACK_MSG_SEM_ROTA
      || 'Não identifiquei a matéria da sua dúvida. Pode reformular? Por exemplo: Qual é a capital do Brasil? ou O que é fotossíntese?',
    sttRetry: process.env.FALLBACK_MSG_STT_RETRY
      || 'Não consegui entender bem. Por favor, fale sua dúvida novamente de forma clara.',
    sttEncerrar: process.env.FALLBACK_MSG_STT_ENCERRAR
      || 'Não consegui entender sua dúvida. Por favor, tente ligar novamente em um local mais silencioso. Até logo!',
    boasVindas: process.env.MSG_BOAS_VINDAS
      || 'Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo.',
    proximoTurno: process.env.MSG_PROXIMO_TURNO
      || 'Pode fazer outra pergunta ou pressione qualquer tecla para encerrar.',
    encerramento: process.env.MSG_ENCERRAMENTO
      || 'Até logo!',
  },
};
