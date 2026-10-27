// src/index.js — Entrypoint do telephony-handler
'use strict';

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`telephony-handler listening on port ${PORT}`);
});
