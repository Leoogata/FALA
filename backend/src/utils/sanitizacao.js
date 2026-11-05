// src/utils/sanitizacao.js — Sanitização de texto para conformidade com US-09 (backend)
// Camada de defesa em profundidade: reaplica a sanitização no servidor antes de qualquer
// gravação, mesmo que o telephony-handler já tenha sanitizado na origem.
'use strict';

// Expressões regulares para detecção de dados pessoais
const PADROES_PESSOAIS = [
  // CPF: 000.000.000-00 (formatado) ou 00000000000 (11 dígitos contínuos)
  { re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g, label: '[DADO_REMOVIDO]' },
  // Telefone: +55 11 90000-0000, (11) 90000-0000, 11900000000
  { re: /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)(?:9\s?\d{4}|\d{4})[-\s.]?\d{4}\b/g, label: '[DADO_REMOVIDO]' },
  // E-mail
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, label: '[DADO_REMOVIDO]' },
  // RG: requer formato explícito com pontos e traço
  { re: /\b\d{1,2}\.\d{3}\.\d{3}-[0-9Xx]\b/g, label: '[DADO_REMOVIDO]' },
];

// Padrões contextuais de nomes de pessoas reais
const PADROES_NOME = [
  // Apresentação direta
  /\b(?:meu nome é|me chamo|sou (?:o|a)|me chamam de)\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+)*)/gi,
  // Referência a familiar
  /\b(?:minh[ao]\s+(?:mãe|filh[ao]|irmã|irmão|avó|avô|esposa|namorada)|meu\s+(?:pai|filho|irmão|avô|esposo|namorado))\s+([A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+(?:\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-záéíóúâêîôûãõ]+)*)/gi,
];

// Padrões contextuais de endereços pessoais
const PADROES_ENDERECO = [
  /\b(?:mora|vive|fica|resid[eo])\s+(?:n[ao]s?\s+)?(?:Rua|Av(?:enida)?|Alameda|Travessa|Estrada|Rodovia|Praça|Largo)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][^,.;?!]{0,60}/gi,
  /\b(?:n[ao]s?\s+)?(?:Rua|Av(?:enida)?|Alameda|Travessa|Estrada|Rodovia|Praça|Largo)\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕ][a-zA-ZÀ-ÿ\s]+\s+\d+\b/gi,
];

/**
 * Sanitiza texto removendo padrões de dados pessoais conhecidos.
 * Retorna o texto sanitizado, ou null se mais de 70% foi removido.
 *
 * @param {string | null | undefined} texto
 * @returns {{ texto: string | null, suprimido: boolean }}
 */
export function sanitizar(texto) {
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
