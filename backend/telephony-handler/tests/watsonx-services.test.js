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
});
