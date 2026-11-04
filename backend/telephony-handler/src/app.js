// src/app.js — Configuração Express
'use strict';

const express = require('express');
const voiceRoutes = require('./routes/voice');
const { consumirAudio } = require('./services/tts');

const app = express();

// Atrás de proxy (ngrok/Cloudflare/etc.): confia no X-Forwarded-Proto
// para que req.protocol reflita o https real da URL pública, não o http
// que o proxy usa internamente. Essencial para a validação de assinatura Twilio.
app.set('trust proxy', true);

// O Twilio envia payloads como application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/voice', voiceRoutes);

/**
 * GET /audio/:id — Serve áudios MP3 gerados pelo ElevenLabs.
 *
 * Endpoint one-shot: o buffer é consumido e removido da memória após a
 * primeira requisição. O Twilio busca a URL exatamente uma vez via <Play>.
 * IDs expiram automaticamente após 5 minutos (TTL do audioStore).
 */
app.get('/audio/:id', (req, res) => {
  const buffer = consumirAudio(req.params.id);
  if (!buffer) {
    return res.status(404).end();
  }
  res.set('Content-Type', 'audio/mpeg');
  res.set('Content-Length', buffer.byteLength);
  res.set('Cache-Control', 'no-store');
  res.send(buffer);
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
