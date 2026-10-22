# backend/api — API de Campanhas e Documentos

**Responsável pela US-04.**

Serviço de backend que expõe o CRUD de campanhas e os endpoints de upload/remoção de documentos. É consumido pelo front de campanhas (US-06), pelo pipeline de RAG (US-05) e pela URA de telefonia (US-07).

## O que faz

- Cria, lista, edita e desativa campanhas
- Faz upload de documentos (PDF/TXT) para uma campanha
- Remove documentos de uma campanha
- Expõe status das campanhas para a URA decidir o roteamento

## O que precisa estar aqui

- Modelagem do banco (tabelas `campanhas` e `documentos`)
- Migrations
- Endpoints:
  - `POST /campanhas`
  - `GET /campanhas`
  - `PATCH /campanhas/:id` (inclui ativar/desativar)
  - `DELETE /campanhas/:id`
  - `POST /campanhas/:id/documentos` (upload)
  - `DELETE /campanhas/:id/documentos/:docId`
- Validação: aceita apenas PDF e TXT; tamanho máximo configurável
- Integração com storage (local, S3 ou equivalente) para persistir os arquivos
- Testes dos endpoints (unit + integração)

## O que NÃO deve estar aqui

- Lógica de chunking, embeddings ou indexação RAG (isso é `backend/rag-pipeline`)
- UI (isso é `frontend/campaigns`)
- Qualquer coisa relacionada a telefonia

## Como fala com os outros módulos

- **rag-pipeline** escuta o evento de upload daqui para disparar a indexação
- **frontend/campaigns** consome todos os endpoints
- **telephony** consulta `GET /campanhas` para montar a URA

## Setup

A ser preenchido quando a stack for escolhida (Node/Express, Python/FastAPI, etc.).
