// src/services/sanitizacao.js — Sanitização de texto para conformidade com US-09
// Remove dados pessoais antes de qualquer gravação ou envio ao modelo.
'use strict';

// Expressões regulares para detecção de dados pessoais
const PADROES_PESSOAIS = [
  // CPF: 000.000.000-00 (formatado) ou 00000000000 (11 dígitos contínuos)
  // Requer separadores no formato pontilhado, ou 11 dígitos sem separador algum,
  // para não confundir com números de página/exercício.
  { re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g, label: '[DADO_REMOVIDO]' },
  // Telefone: +55 11 90000-0000, (11) 90000-0000, 11900000000
  { re: /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)(?:9\s?\d{4}|\d{4})[-\s.]?\d{4}\b/g, label: '[DADO_REMOVIDO]' },
  // E-mail
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: '[DADO_REMOVIDO]' },
  // RG: requer formato explícito com pontos e traço (ex: 12.345.678-9 ou 1.234.567-X)
  // A forma sem formatação (ex: 12345678) é omitida para evitar falsos positivos em
  // números de exercícios, páginas e anos históricos.
  { re: /\b\d{1,2}\.\d{3}\.\d{3}-[0-9Xx]\b/g, label: '[DADO_REMOVIDO]' },
];

// Padrões contextuais de nomes de pessoas reais (não pedagógicos).
// Grupo 1 captura o nome próprio para substituição seletiva.
const PADROES_NOME = [
  // Apresentação direta: "meu nome é X", "me chamo X", "sou o/a X", "me chamam de X"
  /\b(?:meu nome é|me chamo|sou (?:o|a)|me chamam de)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+)*)/gi,
  // Referência a familiar: "minha mãe X", "meu pai X", "minha irmã X", etc.
  /\b(?:minh[ao]\s+(?:mãe|filh[ao]|irmã|irmão|avó|avô|esposa|namorada)|meu\s+(?:pai|filho|irmão|avô|esposo|namorado))\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+)*)/gi,
];

// Padrões contextuais de endereços pessoais.
// Detecta logradouros com número seguido de contexto de moradia/localização.
const PADROES_ENDERECO = [
  // "mora na/em Rua X 123", "vive na/em Av X 45", "fica na Rua X"
  /\b(?:mora|vive|fica|resid[eo])\s+(?:n[ao]s?\s+)?(?:Rua|Av(?:enida)?|Alameda|Travessa|Estrada|Rodovia|Praça|Largo)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][^,.;?!]{0,60}/gi,
  // "na Rua X, número Y" / "na Av X 123"
  /\b(?:n[ao]s?\s+)?(?:Rua|Av(?:enida)?|Alameda|Travessa|Estrada|Rodovia|Praça|Largo)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-zA-ZÀ-ÿ\s]+\s+\d+\b/gi,
];

/**
 * Sanitiza texto removendo padrões de dados pessoais conhecidos.
 * Retorna { texto: string, suprimido: boolean }.
 * `suprimido: true` indica que não foi possível sanitizar com segurança e o texto foi removido totalmente.
 *
 * @param {string | null | undefined} texto
 * @returns {{ texto: string | null, suprimido: boolean }}
 */
function sanitizar(texto) {
  if (!texto || !texto.trim()) return { texto: texto ?? null, suprimido: false };

  let resultado = texto;
  let modificado = false;

  for (const { re, label } of PADROES_PESSOAIS) {
    const novo = resultado.replace(re, label);
    if (novo !== resultado) modificado = true;
    resultado = novo;
  }

  for (const re of PADROES_NOME) {
    const novo = resultado.replace(re, (match, nome) => match.replace(nome, '[DADO_REMOVIDO]'));
    if (novo !== resultado) modificado = true;
    resultado = novo;
  }

  for (const re of PADROES_ENDERECO) {
    const novo = resultado.replace(re, '[DADO_REMOVIDO]');
    if (novo !== resultado) modificado = true;
    resultado = novo;
  }

  // Suprimir completamente somente se quase todo o conteúdo foi removido
  // (heurística: mais de 70% do texto foi substituído por marcadores)
  if (modificado) {
    const marcadoresBytes = (resultado.match(/\[DADO_REMOVIDO\]/g) || []).length * '[DADO_REMOVIDO]'.length;
    const textoRestante = resultado.length - marcadoresBytes;
    const taxaRemocao = 1 - textoRestante / texto.length;
    if (taxaRemocao > 0.7) {
      return { texto: null, suprimido: true };
    }
  }

  return { texto: resultado, suprimido: false };
}

module.exports = { sanitizar };
