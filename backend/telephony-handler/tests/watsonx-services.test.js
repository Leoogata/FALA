'use strict';

process.env.WATSONX_API_KEY = 'test-api-key';
process.env.WATSONX_AGENT_ORCHESTRATOR_ID = 'fala_orchestrator_llama_v2';
process.env.WATSONX_AGENT_ID_GEOGRAFIA = 'fala_agent_geografia';

jest.mock('axios');

const axios = require('axios');
const { routeQuestion } = require('../src/services/orchestrator');
const { answerQuestion } = require('../src/services/agentEducational');

describe('clientes de implantações watsonx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['inexistente', 'historia', null])('rejeita campanha inválida ou inativa: %s', async (campanhaId) => {
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: JSON.stringify({ campanhaId, confianca: 0.9, sem_rota: false }) }] } });

    await expect(routeQuestion({ pergunta: 'Pergunta', campanhasAtivas: [{ campanhaId: 'geografia' }] }))
      .rejects.toThrow('ID de campanha inválido ou inativo');
  });

  test('envia a variável input para a implantação do orquestrador', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({
        data: {
          results: [{ generated_text: '{"campanhaId":"geografia","confianca":0.91,"sem_rota":false}' }],
        },
      });

    await expect(routeQuestion({
      pergunta: 'Qual é a capital do Brasil?',
      campanhasAtivas: [{ campanhaId: 'geografia' }],
    })).resolves.toEqual({ campanhaId: 'geografia', confianca: 0.91, sem_rota: false });

    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      'https://us-south.ml.cloud.ibm.com/ml/v1/deployments/fala_orchestrator_llama_v2/text/generation?version=2021-05-01',
      {
        parameters: {
          prompt_variables: {
            input: JSON.stringify({
              pergunta: 'Qual é a capital do Brasil?',
              campanhasAtivas: [{ campanhaId: 'geografia' }],
            }),
          },
        },
      },
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer iam-token' }),
      })
    );
  });

  test('usa o ID do subagente da matéria e aceita JSON cercado por markdown', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({
        data: {
          results: [{ generated_text: '```json\n{"resposta":"Brasília.","confianca":0.9,"sem_resposta":false}\n```' }],
        },
      });

    await expect(answerQuestion({
      campanhaId: 'geografia',
      pergunta: 'Qual é a capital do Brasil?',
    })).resolves.toEqual({ resposta: 'Brasília.', confianca: 0.9, sem_resposta: false });

    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      'https://us-south.ml.cloud.ibm.com/ml/v1/deployments/fala_agent_geografia/text/generation?version=2021-05-01',
      expect.objectContaining({
        parameters: {
          prompt_variables: {
            input: JSON.stringify({
              campanhaId: 'geografia',
              pergunta: 'Qual é a capital do Brasil?',
            }),
          },
        },
      }),
      expect.any(Object)
    );
  });

  test('extrai JSON quando o modelo retorna texto antes do objeto sem fence', async () => {
    const bareWithPreamble = 'Aqui está a resposta:\n{"resposta":"Brasília","confianca":1.0,"sem_resposta":false}';
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: bareWithPreamble }] } });

    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Capital?' }))
      .resolves.toEqual({ resposta: 'Brasília', confianca: 1.0, sem_resposta: false });
  });

  test('aceita JSON repetido antes de uma fence', async () => {
    const duplicated =
      '{"resposta":"Brasília","confianca":1.0,"sem_resposta":false}\n\n```json\n{"resposta":"Brasília","confianca":1.0,"sem_resposta":false}\n```';
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: duplicated }] } });

    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Capital?' }))
      .resolves.toEqual({ resposta: 'Brasília', confianca: 1.0, sem_resposta: false });
  });

  test('extrai a primeira resposta antes de uma nova entrada gerada pelo modelo', async () => {
    const raw = '{"resposta":"O dia São João é comemorado em 24 de Junho.","confianca":1.0,"sem_resposta":false}\n\nEntrada:\n{"campanhaId":"portugues","pergunta":"Quem é o autor?"}\nSa';
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: raw }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'São João?' }))
      .resolves.toEqual({ resposta: 'O dia São João é comemorado em 24 de Junho.', confianca: 1, sem_resposta: false });
  });

  test('respeita chaves e aspas escapadas em strings e objetos aninhados', async () => {
    const response = { resposta: 'Use "{chaves}" e uma barra \\ no exemplo.', confianca: 0.9, sem_resposta: false, extra: { valor: { n: 1 } } };
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: `Texto ${JSON.stringify(response)} depois {"outro":true}` }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Pergunta' }))
      .resolves.toEqual({ resposta: response.resposta, confianca: 0.9, sem_resposta: false });
  });

  test('tenta outro objeto quando o primeiro não é JSON válido', async () => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: '{inválido} {"resposta":"Brasília","confianca":1,"sem_resposta":false}' }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Capital?' }))
      .resolves.toEqual({ resposta: 'Brasília', confianca: 1, sem_resposta: false });
  });

  test.each([
    {},
    { resposta: 'x', confianca: '1', sem_resposta: false },
    { resposta: 'x', confianca: 1.1, sem_resposta: false },
    { resposta: 'x', confianca: 1, sem_resposta: 'false' },
    { resposta: '', confianca: 1, sem_resposta: false },
    { resposta: 'x', confianca: 0, sem_resposta: true },
  ])('rejeita resposta educacional fora do contrato: %j', async (result) => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: JSON.stringify(result) }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Pergunta' }))
      .rejects.toThrow('Resposta inválida do subagente educacional');
  });

  test.each([
    { campanhaId: 'geografia', confianca: '0.9', sem_rota: false },
    { campanhaId: 'geografia', confianca: -0.1, sem_rota: false },
    { campanhaId: 'geografia', confianca: 0.9, sem_rota: 'false' },
    { campanhaId: 'geografia', confianca: 0.9 },
  ])('rejeita resposta do orquestrador fora do contrato: %j', async (result) => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: JSON.stringify(result) }] } });
    await expect(routeQuestion({ pergunta: 'Pergunta', campanhasAtivas: [{ campanhaId: 'geografia' }] }))
      .rejects.toThrow('Resposta inválida do orquestrador');
  });

  test('não usa um exemplo posterior quando o primeiro objeto viola o contrato', async () => {
    const raw = '{"resposta":"incompleta"}\n{"resposta":"exemplo","confianca":1,"sem_resposta":false}';
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: raw }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Pergunta' }))
      .rejects.toThrow('Resposta inválida do subagente educacional');
  });

  test('rejeita saída truncada sem objeto válido', async () => {
    axios.post.mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({ data: { results: [{ generated_text: '{"resposta":"incompleta"' }] } });
    await expect(answerQuestion({ campanhaId: 'geografia', pergunta: 'Pergunta' }))
      .rejects.toThrow('Não foi possível extrair um objeto JSON válido');
  });
});
