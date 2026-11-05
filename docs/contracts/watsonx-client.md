# Contrato — Cliente RAG

Interface já utilizada pelo pipeline e pela busca HTTP. O cliente simulado está implementado em `backend/src/rag/watsonxClient.js`; o cliente remoto continua pendente. Este documento preserva o contrato necessário para implementar essa versão.

## Princípios

1. **Operações do índice RAG passam por este cliente.** Chamadas de geração aos agentes usam clientes separados no serviço de voz.
2. **Isolamento por campanha é por metadado**, não por índice físico. Cada chunk carrega `{ campanhaId, documentoId }`; as operações filtram por `campanhaId`.
3. **Todas as operações de escrita/remoção são idempotentes.** Chamar duas vezes com os mesmos argumentos produz o mesmo estado final, sem erro. Isso é obrigatório — a estratégia de "sem estado preso" do pipeline depende disso.

---

## Funções

### `indexChunks(campanhaId, chunks)`

Indexa os chunks de um documento no watsonx, associados a uma campanha.

**Parâmetros**

| Nome | Tipo | Descrição |
|------|------|-----------|
| `campanhaId` | `string` | CUID da campanha. Usado como metadado de isolamento em cada chunk. |
| `chunks` | `Chunk[]` | Lista de chunks a indexar (ver formato abaixo). |

**Formato de `Chunk`**

```js
{
  documentoId: string,   // CUID do documento de origem
  texto: string,         // conteúdo do chunk
  ordem: number          // índice do chunk dentro do documento (0, 1, 2, ...)
}
```

O cliente é responsável por anexar `{ campanhaId, documentoId }` como metadado de cada chunk no watsonx.

**Retorno**

```js
Promise<{ indexados: number }>   // quantos chunks foram efetivamente indexados
```

**Erros**

- Lança erro se o watsonx estiver inacessível ou rejeitar a operação.
- O chamador (pipeline) captura o erro e marca o documento como `ERRO`.

**Idempotência**

- Re-indexar os mesmos `documentoId` + `ordem` deve substituir (não duplicar) os chunks existentes daquele documento.

---

### `search(campanhaId, query, opcoes?)`

Busca os chunks mais relevantes para uma pergunta, **restrito a uma campanha**.

> Consumido pelo endpoint `/rag/search`; o serviço de voz usa os textos retornados para enriquecer a entrada do subagente.

**Parâmetros**

| Nome | Tipo | Descrição |
|------|------|-----------|
| `campanhaId` | `string` | CUID da campanha. Filtro obrigatório — a busca **nunca** retorna chunks de outra campanha. |
| `query` | `string` | Texto da pergunta do aluno (já transcrita pelo STT). |
| `opcoes` | `object?` | Opcional. `{ topK?: number }` — quantos chunks retornar (default 5). |

**Retorno**

```js
Promise<{
  resultados: Array<{
    documentoId: string,
    texto: string,
    score: number        // relevância, 0–1
  }>
}>
```

**Garantia de isolamento**

- Nenhum resultado pode ter origem em campanha diferente de `campanhaId`. Este é o requisito central da US-05.

---

### `deleteDocumentChunks(campanhaId, documentoId)`

Remove todos os chunks de um documento específico do índice da campanha.

**Parâmetros**

| Nome | Tipo | Descrição |
|------|------|-----------|
| `campanhaId` | `string` | CUID da campanha. |
| `documentoId` | `string` | CUID do documento cujos chunks serão removidos. |

**Retorno**

```js
Promise<{ removidos: number }>   // quantos chunks foram removidos (0 é válido)
```

**Idempotência — OBRIGATÓRIA**

Esta é a função mais sensível do contrato. Ela precisa ser segura de chamar:

- **Duas ou mais vezes** para o mesmo documento (a remoção de documento durante `PROCESSANDO` pode disparar chamadas duplicadas).
- Para um documento que **nunca teve chunks indexados** (ex.: o pipeline falhou antes de indexar qualquer coisa, ou foi deletado antes de começar).

Em todos esses casos a função deve **retornar normalmente com `{ removidos: 0 }`**, nunca lançar erro. Se ela lançar erro quando não há nada a remover, a lógica de limpeza do pipeline e do cascade delete quebra.

**Erros**

- Só deve lançar erro em falha real de comunicação com o watsonx (ex.: timeout, 5xx), nunca por "documento não encontrado".

---

## Onde cada função é usada

| Função | Chamada por | US |
|--------|-------------|-----|
| `indexChunks` | `src/rag/pipeline.js` | US-05 |
| `deleteDocumentChunks` | `pipeline.js` (limpeza) + `documentos.service.js` (DELETE) + cascade delete de campanha | US-05 / US-04 |
| `search` | handler de voz / agente educacional | US-08-handler / US-08-agent |

---

## Implementação restante

O formato de retorno, chunking no backend e `topK` padrão 5 já são usados pelo código. Falta implementar armazenamento vetorial remoto, metadados e isolamento reais, persistência após reinício e operações idempotentes. As definições de RAG no schema geral dos agentes também precisam ser conferidas contra esta interface antes da integração remota.

Acompanhe os critérios em [pendências](../pendencias.md#2-implementar-o-rag-remoto). Este contrato não é uma nova tarefa de reimplementar a versão simulada.
