'use strict';
const axios = require('axios');
const config = require('../config');

async function resolverEscola(codigo) {
  try {
    const response = await axios.get(
      `${config.backendApiUrl}/escolas/${encodeURIComponent(codigo)}`,
      { timeout: 5000 },
    );
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

module.exports = { resolverEscola };
