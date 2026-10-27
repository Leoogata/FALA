// src/app.js — Configuração Express
'use strict';

const express = require('express');
const voiceRoutes = require('./routes/voice');

const app = express();

// O Twilio envia payloads como application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/voice', voiceRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
