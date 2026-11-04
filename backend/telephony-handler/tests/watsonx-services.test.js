'use strict';

process.env.WATSONX_API_KEY = 'test-api-key';
process.env.WATSONX_AGENT_ORCHESTRATOR_ID = 'fala_orchestrator_llama_v2';
process.env.WATSONX_AGENT_ID_GEOGRAFIA = 'fala_agent_geografia';
process.env.BACKEND_API_URL = 'http://localhost:3001';
process.env.RAG_INTERNAL_TOKEN = 'token-de-teste-para-rag-search';

jest.mock('axios');

const axios = require('axios');
const { routeQuestion } = require('../src/services/orchestrator');
const { answerQuestion, fetchRagContext } = require('../src/services/agentEducational');

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
    // axios.get → RAG search (retorna vazio = sem contexto)
    axios.get.mockResolvedValueOnce({ data: { resultados: [] } });

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

    // Sem contexto RAG (resultados=[]), a pergunta chega ao agente sem prefixo
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

  test('injeta contexto RAG na pergunta quando chunks estão disponíveis', async () => {
    const chunk = 'Brasília foi inaugurada em 1960 como nova capital federal do Brasil.';

    // axios.get → RAG search retorna um chunk relevante
    axios.get.mockResolvedValueOnce({
      data: { resultados: [{ documentoId: 'doc-1', texto: chunk, score: 0.95 }] },
    });

    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'iam-token' } })
      .mockResolvedValueOnce({
        data: {
          results: [{ generated_text: '{"resposta":"Brasília, inaugurada em 1960.","confianca":0.97,"sem_resposta":false}' }],
        },
      });

    await answerQuestion({ campanhaId: 'geografia', pergunta: 'Qual é a capital do Brasil?' });

    // A pergunta enviada ao agente deve conter o contexto RAG
    const chamadaAgente = axios.post.mock.calls[1];
    const inputEnviado = JSON.parse(chamadaAgente[1].parameters.prompt_variables.input);
    expect(inputEnviado.pergunta).toContain('Contexto dos documentos da campanha:');
    expect(inputEnviado.pergunta).toContain(chunk);
    expect(inputEnviado.pergunta).toContain('Qual é a capital do Brasil?');
  });

  test('fetchRagContext retorna null e não bloqueia quando RAG está indisponível', async () => {
    axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const resultado = await fetchRagContext('geografia', 'Qual é a capital?');
    expect(resultado).toBeNull();
  });

  test('fetchRagContext retorna null quando RAG search não encontra chunks', async () => {
    axios.get.mockResolvedValueOnce({ data: { resultados: [] } });

    const resultado = await fetchRagContext('matematica', 'O que é fração?');
    expect(resultado).toBeNull();
  });

  test('fetchRagContext concatena múltiplos chunks com separador', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        resultados: [
          { documentoId: 'doc-1', texto: 'Chunk A', score: 0.9 },
          { documentoId: 'doc-1', texto: 'Chunk B', score: 0.8 },
        ],
      },
    });

    const resultado = await fetchRagContext('matematica', 'fração');
    expect(resultado).toBe('Chunk A\n\nChunk B');
  });
});
