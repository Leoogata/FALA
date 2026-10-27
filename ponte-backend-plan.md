# Ponte Backend — Plano de Implementação

## Visão Geral

Backend da plataforma **Ponte**: sistema de ensino via chamada telefônica que usa RAG (Retrieval-Augmented Generation) para responder perguntas de estudantes. Este plano cobre duas User Stories:

- **US-04** — API REST de Campanhas e Documentos (CRUD)
- **US-05** — Pipeline de Indexação RAG por campanha

Stack: Node.js LTS (ES Modules) · Express · PostgreSQL · Prisma · Multer · Zod · Swagger · Jest + Supertest

---

## Suposições Registradas

1. **Armazenamento de arquivos**: salvo localmente em `/uploads` com caminho no banco. Interface isolada para troca futura por S3/Object Storage.
2. **Persistência de chunks**: chunks NÃO são persistidos no banco — PostgreSQL guarda apenas o status de indexação. A fonte de verdade dos chunks é o watsonx.
3. **Autenticação**: nenhuma no MVP. Sistema de telefonia chama diretamente.
4. **Tamanho máximo de upload**: variável `MAX_UPLOAD_SIZE_MB`, default `10`.
5. **Isolamento por campanha no watsonx**: feito via metadado `{ campanhaId, documentoId }` em cada chunk. `search(campanhaId, query)` filtra por esse metadado.
6. **Retry de indexação**: não há retry automático no MVP. Falha resulta em status `ERRO` com mensagem armazenada.
7. **`DELETE /campanhas/:id`**: retorna `409` por padrão quando há documentos. Aceita `?cascade=true` para remoção completa (documentos + chunks watsonx) de forma opt-in e explícita.
8. **`DELETE /campanhas/:id/documentos/:docId`**: permite remoção mesmo com status `PROCESSANDO`. Pipeline detecta registro ausente, chama `deleteDocumentChunks` por precaução e descarta o resultado — evita estado preso no MVP com fila em memória.
9. **Raiz do app**: o app Express vive em `backend/` — um único `package.json`, um único `src/`. Os diretórios `backend/api/` e `backend/rag-pipeline/` que existiam como placeholders são absorvidos por esta estrutura. A lógica de API fica em `src/` e a lógica RAG em `src/rag/`, dentro do mesmo serviço.

---

## Estrutura de Pastas

Raiz do app: `backend/`

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.js                        # Cria app Express, registra middlewares e rotas
│   ├── server.js                     # Ponto de entrada — app.listen
│   ├── config/
│   │   └── env.js                    # Lê e valida variáveis de ambiente via Zod
│   ├── routes/
│   │   ├── index.js                  # Agrega rotas e monta /api-docs
│   │   ├── campanhas.routes.js
│   │   └── documentos.routes.js
│   ├── controllers/
│   │   ├── campanhas.controller.js   # HTTP in → service call → HTTP out (fino)
│   │   └── documentos.controller.js
│   ├── services/
│   │   ├── campanhas.service.js      # Regras de negócio de campanhas
│   │   └── documentos.service.js    # Regras de negócio + disparo do pipeline
│   ├── repositories/
│   │   ├── campanhas.repository.js   # Queries Prisma para Campanha
│   │   └── documentos.repository.js  # Queries Prisma para Documento
│   ├── middlewares/
│   │   ├── errorHandler.js           # Middleware de erro centralizado (último da cadeia)
│   │   ├── validate.js               # Factory que aplica schema Zod a body/params/query
│   │   └── upload.js                 # Configuração Multer (filtro MIME + extensão + tamanho)
│   ├── rag/
│   │   ├── pipeline.js               # Orquestra chunking → watsonx; detecta registro ausente
│   │   ├── chunker.js                # Divide texto em chunks (CHUNK_SIZE / CHUNK_OVERLAP via env)
│   │   ├── queue.js                  # Fila em memória; interface pronta para trocar por BullMQ/SQS
│   │   └── watsonxClient.js          # Interface + mock do cliente watsonx
│   ├── schemas/
│   │   ├── campanha.schema.js        # Schemas Zod de criação e edição de campanha
│   │   └── documento.schema.js       # Schemas Zod de upload e parâmetros de documento
│   └── docs/
│       └── swagger.js                # Configuração swagger-jsdoc (info, servers, tags)
├── uploads/                          # Arquivos recebidos (gitignored)
├── tests/
│   ├── campanhas.test.js
│   ├── documentos.test.js
│   └── rag/
│       └── pipeline.test.js
├── .env.example
├── .env                              # (gitignored)
├── package.json
└── README.md
```

> Os placeholders `backend/api/` e `backend/rag-pipeline/` que existiam no repo são substituídos por esta estrutura. Não criar novos `package.json` dentro deles.

---

## Modelagem do Banco (Prisma)

### Model `Campanha`

| Campo | Tipo Prisma | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | CUID como identificador público |
| `nome` | `String` | 3–100 caracteres |
| `ativa` | `Boolean @default(true)` | `false` bloqueia uso pelo sistema de telefonia |
| `criadaEm` | `DateTime @default(now())` | |
| `atualizadaEm` | `DateTime @updatedAt` | |
| `documentos` | `Documento[]` | Relação 1:N |

### Model `Documento`

| Campo | Tipo Prisma | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `campanhaId` | `String` | FK → `Campanha.id` |
| `nomeOriginal` | `String` | Nome do arquivo como recebido |
| `mimeType` | `String` | `application/pdf` ou `text/plain` |
| `caminhoArquivo` | `String` | Caminho relativo em `/uploads` |
| `statusIndexacao` | `IndexacaoStatus` | Enum — ver abaixo |
| `erroIndexacao` | `String?` | Mensagem de erro; populado apenas em status `ERRO` |
| `criadoEm` | `DateTime @default(now())` | |
| `atualizadoEm` | `DateTime @updatedAt` | |

### Enum `IndexacaoStatus`

```
PROCESSANDO   → documento recebido, pipeline em execução
PRONTO        → chunks indexados com sucesso no watsonx
ERRO          → pipeline falhou; detalhes em erroIndexacao
```

O campo `erroIndexacao` é `String?` (nullable). Populado apenas em `ERRO`. Mantém diagnóstico acessível via API sem tabela de logs separada no MVP.

**Relação**: `onDelete: Restrict` — impede exclusão de campanha enquanto houver documentos (proteção do default `409`).

---

## Endpoints

### Campanhas

#### `POST /campanhas`
- **Body**: `{ "nome": "string (3–100 chars, obrigatório)" }`
- **201**: `{ id, nome, ativa, criadaEm }`
- **400**: body inválido (Zod)

#### `GET /campanhas`
- **Query**: `?ativa=true|false` (opcional)
- **200**: `[{ id, nome, ativa, criadaEm, _count: { documentos } }]`

#### `GET /campanhas/:id`
- **200**: `{ id, nome, ativa, criadaEm, atualizadaEm, documentos: [{ id, nomeOriginal, mimeType, statusIndexacao, criadoEm }] }`
- **404**: campanha não encontrada

#### `PATCH /campanhas/:id`
- **Body**: `{ "nome"?: "string", "ativa"?: boolean }` (pelo menos um campo)
- **200**: objeto Campanha atualizado
- **400**: body inválido ou vazio
- **404**: campanha não encontrada

#### `DELETE /campanhas/:id`
- **Query**: `?cascade=true` (opcional, opt-in explícito)
- **Comportamento default** (sem `cascade`):
  - **204**: campanha removida (sem documentos)
  - **404**: campanha não encontrada
  - **409**: campanha possui documentos — chamador deve usar `?cascade=true` ou remover documentos manualmente
- **Comportamento com `?cascade=true`**:
  - Itera sobre os documentos da campanha, chama `deleteDocumentChunks` para cada um
  - Remove todos os documentos do banco
  - Remove a campanha
  - **204**: remoção completa concluída
  - **502**: falha ao remover chunks no watsonx — operação abortada, nada removido do banco

### Documentos

#### `POST /campanhas/:id/documentos`
- **Content-Type**: `multipart/form-data`, campo `arquivo`
- **201**: `{ id, nomeOriginal, mimeType, statusIndexacao: "PROCESSANDO", criadoEm }`
- **400**: tipo inválido (não PDF/TXT) ou tamanho excedido
- **404**: campanha não encontrada

#### `DELETE /campanhas/:id/documentos/:docId`
- Remove registro do banco imediatamente, independente do `statusIndexacao`
- Chama `deleteDocumentChunks(campanhaId, docId)` (mesmo se status for `ERRO` — pode ter chunks parciais)
- Pipeline em execução detecta registro ausente ao tentar gravar status final, chama `deleteDocumentChunks` por precaução e descarta resultado
- **204**: documento removido
- **404**: campanha ou documento não encontrado
- **502**: falha ao remover chunks no watsonx — operação abortada, registro permanece no banco

---

## Pipeline de Indexação RAG

### Fluxo

```
DocumentosController
  └─► DocumentosService.uploadDocumento(campanhaId, file)
        ├─ Valida campanha existe (404 se não)
        ├─ Salva arquivo em /uploads
        ├─ INSERT Documento { status: PROCESSANDO }
        ├─ Retorna Documento ao controller → HTTP 201 já enviado
        └─ queue.enqueue({ documentoId, campanhaId, caminhoArquivo })

Queue (setImmediate no MVP)
  └─► pipeline.processar({ documentoId, campanhaId, caminhoArquivo })
        ├─ Lê arquivo do disco
        ├─ chunker.split(texto) → array de chunks
        ├─ watsonxClient.indexChunks(campanhaId, chunks com { documentoId })
        ├─ Se registro ainda existe → UPDATE status=PRONTO
        ├─ Se registro foi deletado → deleteDocumentChunks(campanhaId, documentoId) + descarta
        └─ Em erro → UPDATE status=ERRO, erroIndexacao=mensagem
                     (se registro ausente → deleteDocumentChunks + descarta)
```

### Isolamento por Campanha

Cada chunk enviado a `indexChunks` carrega `{ campanhaId, documentoId }` como metadado. `search(campanhaId, query)` filtra exclusivamente por `campanhaId` no watsonx — nunca mistura campanhas.

### Remoção de Documento Durante PROCESSANDO

1. `DELETE /campanhas/:id/documentos/:docId` remove o registro do banco imediatamente
2. Chama `deleteDocumentChunks` (por precaução, caso já haja chunks parciais)
3. Pipeline, ao finalizar, tenta `UPDATE` no banco → registro não existe → chama `deleteDocumentChunks` novamente + descarta silenciosamente
4. Dupla chamada a `deleteDocumentChunks` é idempotente (operação segura de repetir)

### Interface da Fila (substituível)

`queue.js` expõe `{ enqueue(job), setHandler(fn) }`. No MVP, `enqueue` usa `setImmediate`. Para trocar por BullMQ/SQS/RabbitMQ, apenas este arquivo muda — `pipeline.js` e `documentos.service.js` permanecem intocados.

---

## Ordem de Implementação

```
Etapa 1 — Fundação
  → app.js + server.js + env.js + errorHandler + swagger
  → Sistema sobe em /api-docs sem nenhuma rota de negócio
  → Testável: GET /api-docs retorna 200

Etapa 2 — Schema Prisma + .env.example
  → schema.prisma com Campanha, Documento, IndexacaoStatus
  → Migração gerada e aplicada
  → .env.example com todas as variáveis documentadas
  → Testável: Prisma Client gerado sem erros

Etapa 3 — CRUD de Campanhas
  → campanhas.routes + controller + service + repository
  → Documentação Swagger inline em cada rota
  → Documentos retornados como array vazio por ora
  → Testável: 5 endpoints com Supertest

Etapa 4 — Upload e Remoção de Documentos
  → upload.js (Multer) + documentos.routes + controller + service + repository
  → Validação MIME + extensão + tamanho
  → statusIndexacao fica em PROCESSANDO fixo (pipeline ainda não existe)
  → DELETE de documento funciona (sem pipeline ainda)
  → Testável: POST e DELETE de /documentos com Supertest

Etapa 5 — Pipeline RAG
  → watsonxClient.js (mock) + chunker.js + queue.js + pipeline.js
  → Upload agora dispara o pipeline real (mockado)
  → Status transita PROCESSANDO → PRONTO / ERRO
  → Lógica de registro ausente implementada no pipeline
  → Testável: upload → status vira PRONTO em seguida

Etapa 6 — Testes
  → campanhas CRUD completo
  → upload → indexação → status PRONTO
  → remoção de documento durante PROCESSANDO
  → cascade delete de campanha
```

---

## Pontos de Atenção e Riscos

| # | Ponto | Risco | Mitigação |
|---|---|---|---|
| 1 | **Fila em memória** | Reinicialização perde jobs; documentos ficam em `PROCESSANDO` para sempre | Ao iniciar o servidor, buscar documentos em `PROCESSANDO` com mais de N minutos e marcar como `ERRO` com mensagem "pipeline interrompido por restart" |
| 2 | **Leitura de arquivo no pipeline** | Arquivo movido/deletado manualmente quebra o pipeline silenciosamente | Verificar existência do arquivo no início do pipeline; gravar `ERRO` com mensagem descritiva se ausente |
| 3 | **Validação de MIME type** | `mimetype` do header HTTP pode ser forjado pelo cliente | Validar também extensão do arquivo; em produção, usar `file-type` para inspecionar magic number do buffer |
| 4 | **Tamanho de chunk vs. contexto watsonx** | Chunks muito grandes degradam embeddings; chunks muito pequenos aumentam custo | Expor `CHUNK_SIZE` e `CHUNK_OVERLAP` no `.env.example` com defaults razoáveis (ex: 500/50) e documentar o tradeoff |
| 5 | **Chunks parciais em caso de erro** | Pipeline indexa parcialmente e falha — alguns chunks existem no watsonx, documento fica em `ERRO` | `deleteDocumentChunks` é chamado também no tratamento de erro do pipeline, antes de gravar `ERRO` no banco |
| 6 | **CASCADE no watsonx é sequencial** | `DELETE /campanhas/:id?cascade=true` com muitos documentos pode ser lento | Para o MVP, aceitar a latência. Documentar que operações cascade em campanhas grandes devem ser feitas fora de horário de pico |
| 7 | **Dupla chamada a `deleteDocumentChunks`** | Remoção de documento durante PROCESSANDO pode chamar `deleteDocumentChunks` duas vezes | Garantir que o mock e o cliente real sejam idempotentes nessa operação (watsonx já é por natureza) |

---

## Status das Etapas

- [x] Etapa 1 — Fundação (app, env, Swagger, error handler)
- [x] Etapa 2 — Schema Prisma + .env.example
- [x] Etapa 3 — CRUD de Campanhas
- [x] Etapa 4 — Upload e Remoção de Documentos
- [x] Etapa 5 — Pipeline RAG
- [x] Etapa 6 — Testes
