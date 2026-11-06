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

  agentTimeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '45000', 10),

  // URLs de outros serviços
  backendApiUrl: process.env.BACKEND_API_URL || '',

  // Autenticação interna entre serviços (usado pelo conversaClient)
  internalApiKey: process.env.INTERNAL_API_KEY || '',

  // HMAC de identificação de chamadas (nunca persistir CallSid original)
  hmacSecret: process.env.HMAC_SECRET || '',
  hmacSecretVersion: process.env.HMAC_SECRET_VERSION || 'v1',

  // Timeout para chamadas ao backend de conversas (ms)
  conversaClientTimeoutMs: parseInt(process.env.CONVERSA_CLIENT_TIMEOUT_MS || '8000', 10),

  // Rastreabilidade de prompt implantado no watsonx
  versaoPrompt: process.env.VERSAO_PROMPT || null,
  analyticsServiceUrl: process.env.ANALYTICS_SERVICE_URL || '',
  // URL pública do próprio servidor (ngrok/CF tunnel/produção)
  // Necessária para gerar URLs de áudio acessíveis pelo Twilio via <Play>
  // Ex: https://abc123.ngrok.io  ou  https://fala.seudominio.com
  publicUrl: process.env.PUBLIC_URL || '',

  // ElevenLabs TTS
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  // Voice ID do painel ElevenLabs — default: "Rachel" (pt-BR compatível)
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  // Timeout total para geração de áudio + upload (ms)
  ttsTimeoutMs: parseInt(process.env.TTS_TIMEOUT_MS || '8000', 10),

  // Mensagens de fallback configuráveis
  fallbackMessages: {
    semResposta: process.env.FALLBACK_MSG_SEM_RESPOSTA
      || 'Não consegui responder a essa pergunta. Você pode reformular ou consultar seu professor.',
    semRota: process.env.FALLBACK_MSG_SEM_ROTA
      || 'Não identifiquei a matéria da sua dúvida. Pode reformular? Por exemplo: Qual é a capital do Brasil? ou O que é fotossíntese?',
    sttRetry: process.env.FALLBACK_MSG_STT_RETRY
      || 'Não consegui entender bem. Por favor, fale sua dúvida novamente de forma clara.',
    sttEncerrar: process.env.FALLBACK_MSG_STT_ENCERRAR
      || 'Não consegui entender sua dúvida. Por favor, tente ligar novamente em um local mais silencioso. Até logo!',
    boasVindas: process.env.MSG_BOAS_VINDAS
      || 'Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo.',
    pedirCodigo: process.env.MSG_PEDIR_CODIGO
      || 'Olá! Aqui é a FALA. Se você tem o código da sua escola, digite agora no teclado. '
      + 'Para continuar sem código, é só aguardar.',
    codigoInvalido: process.env.MSG_CODIGO_INVALIDO
      || 'Não encontrei esse código de escola. Vou continuar com o conteúdo geral.',
    escolaConfirmada: process.env.MSG_ESCOLA_CONFIRMADA
      || 'Escola encontrada! Agora pode fazer sua pergunta.',
    proximoTurno: process.env.MSG_PROXIMO_TURNO
      || 'Pode fazer outra pergunta ou pressione qualquer tecla para encerrar.',
    encerramento: process.env.MSG_ENCERRAMENTO
      || 'Até logo!',
    indisponibilidade: process.env.FALLBACK_MSG_INDISPONIBILIDADE
      || 'O serviço está temporariamente indisponível. Por favor, tente novamente em instantes.',
  },
};
