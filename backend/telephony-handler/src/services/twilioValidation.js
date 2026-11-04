// src/services/twilioValidation.js — Validação de assinatura Twilio
'use strict';

const twilio = require('twilio');
const config = require('../config');

/**
 * Middleware Express que valida a assinatura X-Twilio-Signature.
 * Em ambiente de teste (NODE_ENV=test) a validação é ignorada para facilitar os testes unitários.
 */
function validateTwilioSignature(req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const authToken = config.twilioAuthToken;
  const signature = req.headers['x-twilio-signature'] || '';

  // A URL usada para validação deve ser EXATAMENTE a URL pública que o Twilio
  // assinou — incluindo o protocolo https. Atrás do ngrok, o TLS termina no
  // proxy e a requisição chega como http internamente; por isso lemos o
  // X-Forwarded-Proto (preenchido pelo ngrok) em vez de req.protocol.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.get('host')}${req.originalUrl}`;
  const params = req.body || {};

  const isValid = twilio.validateRequest(authToken, signature, url, params);

  if (!isValid) {
    console.warn(`[twilioValidation] Assinatura inválida para ${req.method} ${req.originalUrl}`);
    return res.status(403).type('text/xml').send('<Response><Say>Forbidden</Say></Response>');
  }

  next();
}

module.exports = { validateTwilioSignature };
