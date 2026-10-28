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
