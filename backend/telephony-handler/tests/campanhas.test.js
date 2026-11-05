'use strict';

process.env.BACKEND_API_URL = 'http://backend.test';
jest.mock('axios');
const axios = require('axios');
const { getCampanhasAtivas } = require('../src/services/campanhas');

beforeEach(() => jest.clearAllMocks());

test('adapta as campanhas da API e consulta apenas as ativas', async () => {
  axios.get.mockResolvedValue({ data: [
    { id: 'cm123', nome: ' Língua Portuguesa ', descricao: 'Gramática', ativa: true },
    { id: 'cm456', nome: 'Matemática', descricao: 'Operações', ativa: true },
    { id: 'cm789', nome: 'Ciências', descricao: 'Biologia', ativa: false },
  ] });
  await expect(getCampanhasAtivas()).resolves.toEqual([
    { id: 'cm123', campanhaId: 'portugues', nome: ' Língua Portuguesa ', descricao: 'Gramática' },
    { id: 'cm456', campanhaId: 'matematica', nome: 'Matemática', descricao: 'Operações' },
  ]);
  expect(axios.get).toHaveBeenCalledWith('http://backend.test/campanhas', {
    timeout: 5000, params: { ativa: true },
  });
});

test('reconhece os nomes das cinco matérias e preserva os IDs da API', async () => {
  axios.get.mockResolvedValue({ data: ['História', 'Geografia', 'Português', 'Matemática', 'Ciências']
    .map((nome, i) => ({ id: `id-${i}`, nome, descricao: null, ativa: true })) });
  const campanhas = await getCampanhasAtivas();
  expect(campanhas.map(({ id, campanhaId }) => [id, campanhaId])).toEqual([
    ['id-0', 'historia'], ['id-1', 'geografia'], ['id-2', 'portugues'],
    ['id-3', 'matematica'], ['id-4', 'ciencias'],
  ]);
});

test('recusa duas campanhas ativas para a mesma matéria', async () => {
  axios.get.mockResolvedValue({ data: [
    { id: '1', nome: 'História', ativa: true }, { id: '2', nome: 'historia', ativa: true },
  ] });
  await expect(getCampanhasAtivas()).rejects.toThrow('Mais de uma campanha ativa');
});

test('recusa lista sem matéria ativa reconhecida', async () => {
  axios.get.mockResolvedValue({ data: [{ id: '1', nome: 'Matemática', ativa: false }] });
  await expect(getCampanhasAtivas()).rejects.toThrow('Nenhuma campanha ativa');
});
