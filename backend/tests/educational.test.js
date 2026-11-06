import { jest } from '@jest/globals';
const search = jest.fn();
const post = jest.fn();
jest.unstable_mockModule('../src/rag/watsonxClient.js', () => ({ watsonxClient: { search } }));
jest.unstable_mockModule('../src/services/watsonx.service.js', () => ({ watsonxPost: post }));
const { gerarResposta, parseAnswer } = await import('../src/services/educational.service.js');
const resposta = { resposta: 'As plantas produzem alimento.', confianca: 0.9, sem_resposta: false,
  precisa_esclarecimento: false, pergunta_esclarecimento: '' };
const padrao = { modo: 'padrao', id: null, escolaId: null, usaRag: false };
const escola = { modo: 'escola', id: 'a1', escolaId: 'e1', usaRag: true, descricao: 'Ensine ao 6º ano.' };
beforeEach(() => {
  jest.resetAllMocks();
  search.mockResolvedValue({ resultados: [{ documentoId: 'd1', trechoId: 't1', texto: 'Conteúdo da escola.' }] });
  post.mockResolvedValue({ results: [{ generated_text: JSON.stringify(resposta) }] });
});

test('agente padrão responde sem consultar RAG', async () => {
  const result = await gerarResposta({ agente: padrao, pergunta: 'O que é fotossíntese?' });
  expect(search).not.toHaveBeenCalled(); expect(post).toHaveBeenCalledTimes(1);
  expect(result.resposta).toBe(resposta.resposta);
  const input = JSON.parse(post.mock.calls[0][1].parameters.prompt_variables.input);
  expect(input).toMatchObject({ modo: 'padrao', contexto_rag: '', historico: [] });
  expect(post.mock.calls[0][0]).toContain('/text/generation');
  expect(post.mock.calls[0][0]).not.toContain('_stream');
});
test('escola envia instruções e somente os trechos recuperados no seu escopo', async () => {
  const result = await gerarResposta({ agente: escola, pergunta: 'Explique a experiência.' });
  expect(search).toHaveBeenCalledWith('a1', expect.any(String), { escolaId: 'e1', topK: 5 });
  const input = JSON.parse(post.mock.calls[0][1].parameters.prompt_variables.input);
  expect(input).toMatchObject({ modo: 'escola', instrucoes: escola.descricao, contexto_rag: 'Conteúdo da escola.' });
  expect(result.fontes).toEqual([{ documentoId: 'd1', trechoId: 't1' }]);
});
test('sem evidência não consulta modelo nem usa conhecimento geral', async () => {
  search.mockResolvedValue({ resultados: [] });
  expect((await gerarResposta({ agente: escola, pergunta: 'Qual a data da prova?' })).sem_resposta).toBe(true);
  expect(post).not.toHaveBeenCalled();
});
test('erro no RAG é propagado, distinguindo falha de ausência de material', async () => {
  search.mockRejectedValue(new Error('offline'));
  await expect(gerarResposta({ agente: escola, pergunta: 'Qual a data da prova?' })).rejects.toThrow('offline');
  expect(post).not.toHaveBeenCalled();
});
test('rejeita configuração escolar sem vínculo com escola', async () => {
  await expect(gerarResposta({ agente: { ...escola, escolaId: null }, pergunta: 'Uma pergunta.' })).rejects.toMatchObject({ status: 409 });
  expect(search).not.toHaveBeenCalled();
});
test('usa a última troca na busca para resolver continuação de assunto', async () => {
  const historico = [{ pergunta: 'O que é germinação?', resposta: 'É o desenvolvimento da semente.' }];
  await gerarResposta({ agente: escola, pergunta: 'E quanto tempo leva?', historico });
  expect(search.mock.calls[0][1]).toContain('germinação');
  expect(JSON.parse(post.mock.calls[0][1].parameters.prompt_variables.input).historico).toEqual(historico);
});
test('limita histórico às últimas cinco trocas', async () => {
  await gerarResposta({ agente: padrao, pergunta: 'Explique.', historico: Array.from({ length: 8 }, (_, i) => ({ pergunta: `Pergunta ${i}`, resposta: 'Resposta.' })) });
  expect(JSON.parse(post.mock.calls[0][1].parameters.prompt_variables.input).historico).toHaveLength(5);
});
test('suprime pergunta composta somente por dado pessoal antes de chamar IA', async () => {
  expect((await gerarResposta({ agente: padrao, pergunta: '123.456.789-00' })).sem_resposta).toBe(true);
  expect(post).not.toHaveBeenCalled();
});
test('aceita esclarecimento do agente sem resposta pedagógica', async () => {
  const result = { resposta: '', confianca: 0, sem_resposta: true, precisa_esclarecimento: true, pergunta_esclarecimento: 'Qual personagem?' };
  post.mockResolvedValue({ results: [{ generated_text: JSON.stringify(result) }] });
  expect(await gerarResposta({ agente: padrao, pergunta: 'Quando ele nasceu?' })).toMatchObject(result);
});
test.each([
  'não é JSON', JSON.stringify({ ...resposta, resposta: 'x'.repeat(1001) }),
  JSON.stringify({ ...resposta, sem_resposta: true }),
  JSON.stringify({ ...resposta, precisa_esclarecimento: true }),
])('rejeita saída inválida: %s', (text) => {
  expect(() => parseAnswer(text)).toThrow('Resposta inválida');
});
