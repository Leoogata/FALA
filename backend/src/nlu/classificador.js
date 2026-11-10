// src/nlu/classificador.js — Inferência local TF-IDF + LR para classificação de matérias
// Carrega o artefato JSON uma vez por processo e executa classificação em CPU.
// Sem chamadas de rede: conforme spec US-10 §2.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Carregamento único por processo ─────────────────────────────────────────

let _artefato = null;
let _carregamentoErro = null;

function carregarArtefato() {
  if (_artefato !== null) return _artefato;
  if (_carregamentoErro !== null) throw _carregamentoErro;

  try {
    const caminho = resolve(__dirname, 'artefato.json');
    const raw = readFileSync(caminho, 'utf-8');
    _artefato = JSON.parse(raw);
    return _artefato;
  } catch (err) {
    _carregamentoErro = err;
    throw err;
  }
}

// ─── Normalização — espelha treinar.py ───────────────────────────────────────

/**
 * Normaliza texto para inferência: minúsculas, remove acentos,
 * preserva dígitos e operadores matemáticos.
 *
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto) {
  if (!texto) return '';
  let t = texto.toLowerCase();
  // Remove acentos via decomposição unicode
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Mantém letras, dígitos, espaços e operadores matemáticos
  t = t.replace(/[^a-z0-9\s+\-*/%.\\,^]/g, ' ');
  // Colapsa espaços
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// ─── TF-IDF de n-gramas de caracteres ────────────────────────────────────────

/**
 * Extrai n-gramas de caracteres (modo char_wb: bordas de palavra com espaços).
 *
 * @param {string} texto Texto já normalizado
 * @param {number} minN
 * @param {number} maxN
 * @returns {string[]}
 */
function extrairNGramas(texto, minN, maxN) {
  // char_wb: padeia com espaços em cada palavra
  const tokens = ` ${texto} `.split(/\s+/).filter(Boolean).map((w) => ` ${w} `);
  const ngrams = [];
  for (const token of tokens) {
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= token.length - n; i++) {
        ngrams.push(token.slice(i, i + n));
      }
    }
  }
  return ngrams;
}

/**
 * Calcula o vetor TF-IDF esparso usando o vocabulário e pesos IDF do artefato.
 *
 * @param {string} texto Texto já normalizado
 * @param {object} tfidf Objeto tfidf do artefato
 * @returns {Map<number, number>} índice → valor
 */
function vetorTfIdf(texto, tfidf) {
  const [minN, maxN] = tfidf.ngram_range;
  const ngrams = extrairNGramas(texto, minN, maxN);

  // Contagem de termos (TF bruto)
  const tf = new Map();
  for (const ng of ngrams) {
    const idx = tfidf.vocabulario[ng];
    if (idx !== undefined) {
      tf.set(idx, (tf.get(idx) ?? 0) + 1);
    }
  }

  if (tf.size === 0) return new Map();

  // TF com suavização logarítmica: 1 + log(tf)
  const vetor = new Map();
  let norma2 = 0;
  for (const [idx, contagem] of tf) {
    const tfLog = tfidf.sublinear_tf ? 1 + Math.log(contagem) : contagem;
    const val = tfLog * tfidf.idf[idx];
    vetor.set(idx, val);
    norma2 += val * val;
  }

  // Normalização L2
  const norma = Math.sqrt(norma2);
  if (norma > 0) {
    for (const [idx, val] of vetor) {
      vetor.set(idx, val / norma);
    }
  }

  return vetor;
}

// ─── Softmax ─────────────────────────────────────────────────────────────────

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// ─── Inferência ──────────────────────────────────────────────────────────────

/**
 * Classifica uma pergunta sanitizada.
 *
 * @param {string | null} pergunta
 * @returns {{ status: 'classificada' | 'indeterminada' | 'erro', materia: string | null, versao: string }}
 */
export function classificar(pergunta) {
  let artefato;
  try {
    artefato = carregarArtefato();
  } catch {
    return { status: 'erro', materia: null, versao: null };
  }

  try {
    if (!pergunta || !pergunta.trim()) {
      return { status: 'indeterminada', materia: null, versao: artefato.versao };
    }

    const texto = normalizar(pergunta);
    if (!texto) {
      return { status: 'indeterminada', materia: null, versao: artefato.versao };
    }

    const vetor = vetorTfIdf(texto, artefato.tfidf);
    const { classes, coef, intercept } = artefato.lr;
    const { score_minimo, margem_minima } = artefato.limiares;

    // Scores lineares para cada classe
    const logits = classes.map((_, j) => {
      let score = intercept[j];
      for (const [idx, val] of vetor) {
        score += coef[j][idx] * val;
      }
      return score;
    });

    const probs = softmax(logits);

    // Ordenar por probabilidade decrescente
    const indexados = probs.map((p, i) => ({ classe: classes[i], prob: p }))
      .sort((a, b) => b.prob - a.prob);

    const primeira = indexados[0];
    const segunda = indexados[1];

    // Aceitar apenas matérias (não "indeterminada" como resultado explícito)
    const MATERIAS = ['ciencias', 'historia', 'matematica', 'portugues', 'geografia'];

    const ehMateria = MATERIAS.includes(primeira.classe);
    const acimaDaLimiar = primeira.prob >= score_minimo;
    const acimaDaMargem = (primeira.prob - segunda.prob) >= margem_minima;

    if (ehMateria && acimaDaLimiar && acimaDaMargem) {
      return { status: 'classificada', materia: primeira.classe, versao: artefato.versao };
    }

    return { status: 'indeterminada', materia: null, versao: artefato.versao };
  } catch {
    return { status: 'erro', materia: null, versao: artefato?.versao ?? null };
  }
}

/**
 * Retorna a versão do artefato carregado, ou null se não disponível.
 * @returns {string | null}
 */
export function versaoArtefato() {
  try {
    return carregarArtefato().versao;
  } catch {
    return null;
  }
}

// Exporta para testes de paridade
export { extrairNGramas, vetorTfIdf, softmax };
