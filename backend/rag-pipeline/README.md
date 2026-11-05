# Pipeline de documentos e RAG

A implementação está em [backend/src/rag](../src/rag), no processo da API.

## Funcionamento atual

1. O upload cria o registro do documento e enfileira seu processamento.
2. O pipeline extrai TXT/PDF; extração insuficiente em PDF pode acionar OCR.
3. `chunker.js` divide o texto usando `CHUNK_SIZE` e `CHUNK_OVERLAP`, medidos por caracteres.
4. `watsonxClient.indexChunks` recebe o ID real da campanha e os chunks identificados por documento e ordem.
5. O documento passa a `PRONTO` ou `ERRO`. Limpezas tentam remover indexação parcial e dados de documentos excluídos.

A fila é em memória. Na inicialização, a recuperação marca documentos antigos presos em `PROCESSANDO` como erro. Isso não é uma fila durável nem reindexação automática de todo o material.

## Armazenamento

Com `WATSONX_MOCK=true`, indexação, busca e remoção usam um índice em memória. Reiniciar a API perde esse índice. A versão remota (`realClient`) ainda precisa ser implementada.

`GET /rag/search` autentica com `RAG_INTERNAL_TOKEN`, resolve ID/slug da campanha para seu ID real e consulta o cliente. O serviço de voz usa os textos retornados para enriquecer a pergunta.

- [Contrato do cliente](../../docs/contracts/watsonx-client.md).
- [Trabalho restante do RAG](../../docs/pendencias.md#2-implementar-o-rag-remoto).
- [Instalação, variáveis e Docker](../README.md).
