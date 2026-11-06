process.env.BACKEND_API_URL = 'http://backend.test';
process.env.INTERNAL_API_KEY = 'test-internal-key-at-least-32-characters';
jest.mock('axios');
const axios = require('axios');
const { answerQuestion } = require('../src/services/agentEducational');
beforeEach(() => jest.clearAllMocks());
test('envia só a identificação da conversa e do turno ao backend', async () => {
  axios.post.mockResolvedValue({ data: { resposta: 'Quatro.', sem_resposta: false } });
  await expect(answerQuestion({ conversaId: 'c1', turnoToken: 't1' })).resolves.toMatchObject({ resposta: 'Quatro.' });
  expect(axios.post).toHaveBeenCalledWith('http://backend.test/internal/respostas',
    { conversa_id: 'c1', turno_token: 't1' }, expect.objectContaining({
      headers: { Authorization: `Bearer ${process.env.INTERNAL_API_KEY}` }, timeout: 45000,
    }));
  expect(axios.post).toHaveBeenCalledTimes(1);
});
test('propaga falha de busca ou geração para o handler não inventar resposta', async () => {
  axios.post.mockRejectedValue(new Error('RAG indisponível'));
  await expect(answerQuestion({ conversaId: 'c1', turnoToken: 't1' })).rejects.toThrow('RAG indisponível');
});
