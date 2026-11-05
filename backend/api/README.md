# API de campanhas e documentos

Esta pasta mantém a referência do módulo. A implementação executável está em `backend/src`, no mesmo processo da API de memória, analytics e RAG.

## Rotas atuais

| Operação | Rota |
| --- | --- |
| Criar/listar campanhas | `POST /campanhas`, `GET /campanhas` |
| Consultar campanhas para telefonia | `GET /campanhas/ativas` |
| Consultar/editar/remover campanha | `GET`, `PATCH`, `DELETE /campanhas/:id` |
| Enviar/listar documentos | `POST`, `GET /campanhas/:id/documentos` |
| Consultar/remover documento | `GET`, `DELETE /campanhas/:id/documentos/:docId` |
| Sugerir instruções | `POST /instrucoes/melhorar` — stub |
| Testar agente no painel | `POST /campanhas/:id/testar` — stub |

`id` é a chave real da campanha; `slug` identifica a matéria. A resposta usada pela telefonia contém ambos. O CRUD do painel serializa `descricao` como `instrucoes` na leitura e aceita o alias na edição.

Uploads aceitam PDF/TXT com limite configurado em `MAX_UPLOAD_SIZE_MB`. O pipeline ocorre em segundo plano. O contrato efetivo de validação está nos schemas e nas rotas em `backend/src`; os códigos de erro e regras de ativação ainda precisam ser alinhados ao painel.

- [Instalação e banco](../README.md).
- [Rotas executáveis](../src/routes/campanhas.routes.js).
- [Schemas de campanha](../src/schemas/campanha.schema.js).
- [Pendências do painel e integrações](../../docs/pendencias.md).
