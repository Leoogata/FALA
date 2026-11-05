// src/routes/voice.js — Rotas POST /voice/incoming, POST /voice/turn e POST /voice/status
'use strict';

const express = require('express');
const router = express.Router();

const { validateTwilioSignature } = require('../services/twilioValidation');
const incomingHandler = require('../handlers/incomingHandler');
const escolaHandler = require('../handlers/escolaHandler');
const turnHandler = require('../handlers/turnHandler');
const statusHandler = require('../handlers/statusHandler');

router.post('/incoming', validateTwilioSignature, incomingHandler);
router.post('/escola', validateTwilioSignature, escolaHandler);
router.post('/turn', validateTwilioSignature, turnHandler);
// Callback de término de chamada — encerra a conversa no banco
router.post('/status', validateTwilioSignature, statusHandler);

module.exports = router;
