// src/services/campanhas.js — Busca campanhas ativas no backend/api
'use strict';

const axios = require('axios');
const config = require('../config');

// Mapeamento de nomes de matéria (por nome normalizado) para campanhaId
const NOME_PARA_CAMPANHA_ID = {
  historia: 'historia',
  história: 'historia',
  geografia: 'geografia',
  portugues: 'portugues',
  português: 'portugues',
  'língua portuguesa': 'portugues',
  'lingua portuguesa': 'portugues',
  matematica: 'matematica',
  matemática: 'matematica',
  ciencias: 'ciencias',
  ciências: 'ciencias',
};

/**
 * Normaliza o nome de uma campanha para o campanhaId correspondente.
 * @param {string} nome
 * @returns {string|null}
 */
function normalizarNome(nome) {
  if (!nome) return null;
  const key = nome.trim().toLowerCase();
  return NOME_PARA_CAMPANHA_ID[key] ?? null;
}

/**
 * Busca e adapta as campanhas ativas de GET /campanhas/ativas.
 * Filtra apenas ativas, valida unicidade por matéria e mapeia para o
 * formato interno { id, campanhaId, nome, descricao }.
 *
 * @param {string|null} codigoEscola — se informado, filtra pelas campanhas
 *   daquela escola (?escola=<codigo>); sem ele, retorna o conteúdo geral.
 * @returns {Promise<Array<{ id: string, campanhaId: string, nome: string, descricao: string|null }>>}
 */
async function getCampanhasAtivas(codigoEscola = null) {
  const params = { ativa: true };
  if (codigoEscola) params.escola = codigoEscola;
  const response = await axios.get(`${config.backendApiUrl}/campanhas/ativas`, {
    timeout: 5000,
    params,
  });

  const todas = Array.isArray(response.data) ? response.data : [];

  // Filtrar apenas ativas
  const ativas = todas.filter((c) => c.ativa !== false);

  if (ativas.length === 0) {
    throw new Error('Nenhuma campanha ativa reconhecida na resposta da API');
  }

  // Adaptar para o formato interno, ignorando campanhas sem campanhaId reconhecido
  const vistas = new Map();
  const resultado = [];

  for (const campanha of ativas) {
    const campanhaId = campanha.campanhaId || campanha.slug || normalizarNome(campanha.nome);
    if (typeof campanha.id !== 'string' || !campanha.id.trim()) {
      throw new Error('Campanha ativa sem ID válido');
    }
    if (!campanhaId) continue;

    if (vistas.has(campanhaId)) {
      throw new Error(`Mais de uma campanha ativa para a matéria '${campanhaId}'`);
    }
    vistas.set(campanhaId, true);

    resultado.push({
      id: campanha.id,
      campanhaId,
      nome: campanha.nome,
      descricao: campanha.descricao ?? null,
    });
  }

  if (resultado.length === 0) {
    throw new Error('Nenhuma campanha ativa reconhecida na resposta da API');
  }

  return resultado;
}

/**
 * Resolve o código de escola digitado no telefone.
 * @param {string} codigo
 * @returns {Promise<{ id: string, codigo: string, nome: string }|null>} null se não existir
 */
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

module.exports = { getCampanhasAtivas, resolverEscola };
