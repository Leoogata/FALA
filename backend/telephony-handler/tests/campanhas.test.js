process.env.BACKEND_API_URL = 'http://backend.test';
jest.mock('axios');
const axios = require('axios');
const { resolverEscola } = require('../src/services/campanhas');
beforeEach(() => jest.clearAllMocks());
test('resolve código da escola', async () => {
  axios.get.mockResolvedValue({ data: { id: 'e1', codigo: '1001', nome: 'Escola A' } });
  await expect(resolverEscola('1001')).resolves.toMatchObject({ id: 'e1' });
  expect(axios.get).toHaveBeenCalledWith('http://backend.test/escolas/1001', { timeout: 5000 });
});
test('código inexistente retorna null', async () => {
  axios.get.mockRejectedValue({ response: { status: 404 } });
  await expect(resolverEscola('9999')).resolves.toBeNull();
});
test('erro operacional é propagado', async () => {
  axios.get.mockRejectedValue(new Error('offline'));
  await expect(resolverEscola('1001')).rejects.toThrow('offline');
});
