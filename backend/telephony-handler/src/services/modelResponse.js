'use strict';

// Examina objetos completos individualmente, respeitando strings e escapes JSON.
// O primeiro objeto sintaticamente válido é a resposta; não procuramos um
// exemplo posterior quando ele viola o contrato.
function extractJson(text) {
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth++;
      } else if (char === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch (_) {
          break;
        }
      }
    }
  }
  throw new SyntaxError('Não foi possível extrair um objeto JSON válido da resposta');
}

function parseModelResponse(raw) {
  const result = typeof raw === 'string' ? extractJson(raw) : raw;
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Resposta do modelo deve ser um objeto JSON');
  }
  return result;
}

function validConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

module.exports = { parseModelResponse, validConfidence };
