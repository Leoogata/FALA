// src/routes/voice.js — Rotas POST /voice/incoming e POST /voice/turn
'use strict';

const express = require('express');
const router = express.Router();

const { validateTwilioSignature } = require('../services/twilioValidation');
const incomingHandler = require('../handlers/incomingHandler');
const turnHandler = require('../handlers/turnHandler');

router.post('/incoming', validateTwilioSignature, incomingHandler);
router.post('/turn', validateTwilioSignature, turnHandler);

module.exports = router;
