// src/index.js — Entrypoint do telephony-handler
'use strict';

const app = require('./app');
const config = require('./config');
const { preAquecer } = require('./services/tts');

const PORT = process.env.PORT || 3000;

// Pré-gera as mensagens fixas com ElevenLabs antes de aceitar chamadas.
// Se ElevenLabs estiver indisponível ou as variáveis não estiverem configuradas,
// o servidor sobe normalmente e usa Polly como fallback para todas as mensagens.
preAquecer(config.fallbackMessages).then(() => {
  app.listen(PORT, () => {
    console.log(`telephony-handler listening on port ${PORT}`);
  });
});
