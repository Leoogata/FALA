# backend/rag-pipeline — Pipeline de Indexação RAG

**Responsável pela US-05.**

Pipeline que recebe um documento recém-uploadado, faz chunking, gera embeddings e indexa no watsonx associado a uma campanha. Garante que cada campanha tenha seu índice RAG isolado.

## O que faz

- Escuta eventos de upload da `backend/api`
- Faz chunking do documento com tamanho e overlap configuráveis
- Gera embeddings e indexa no watsonx
- Marca cada chunk com `campanha_id` para isolamento
- Atualiza o status de indexação do documento (`processando` → `pronto` | `erro`)
- Remove chunks de um documento quando ele é deletado

## O que precisa estar aqui

- Worker/consumer da fila de documentos
- Lógica de chunking (texto e PDF)
- Cliente do watsonx para embeddings e indexação
- Lógica de isolamento por campanha (metadata `campanha_id` em cada chunk)
- Mecanismo de atualização de status consultável via API
- Testes do pipeline com documentos de exemplo

## O que NÃO deve estar aqui

- Endpoints HTTP de CRUD de campanhas (isso é `backend/api`)
- Lógica de resposta do agente (isso é `watsonx/agent-educational`)
- UI (nada aqui tem interface)

## Como fala com os outros módulos

- **backend/api** dispara o pipeline no upload e consulta o status
- **watsonx/agent-educational** consome o índice gerado aqui durante a inferência

## Decisões técnicas em aberto

- Fila: SQS? Redis? processamento síncrono para o MVP?
- Chunker: fixo (ex.: 500 tokens com 50 de overlap) ou adaptativo?
- Formato de persistência dos chunks: vetorial próprio do watsonx ou externo?

## Setup

A ser preenchido quando as escolhas acima estiverem feitas.
