# Prompt para o IBM Bob — Backend (US-04 + US-05)

Este documento contém o prompt pronto para colar no IBM Bob. O objetivo é que o Bob gere **primeiro um plano de implementação** (sem código), para você revisar antes de pedir a implementação em etapas.

Copie tudo a partir da linha abaixo.

---

## PROMPT

Você é um engenheiro de backend sênior especializado em Node.js e Express. Vou te dar o contexto de um projeto e duas tarefas bem definidas. **Nesta primeira resposta, NÃO escreva código.** Quero apenas um plano de implementação detalhado para eu revisar. Só vamos escrever código depois que eu aprovar o plano.

### Contexto do projeto

Estou construindo o backend de uma plataforma chamada **Ponte**: um sistema que leva ensino a estudantes de regiões sensíveis via chamada telefônica. O aluno liga, escolhe uma "campanha" (um conjunto de material didático de uma matéria/escola), faz uma pergunta por voz, e um agente de IA com RAG responde. Cada campanha tem seu próprio material e seu próprio índice RAG isolado.

Eu sou responsável por **duas tarefas** do backend:

**Tarefa 1 — API de Campanhas e Documentos (CRUD)**
Uma API REST que permite:
- Criar, listar, editar e desativar campanhas (uma campanha tem: nome, status ativa/inativa, lista de documentos)
- Fazer upload de documentos (apenas PDF e TXT) para uma campanha
- Remover documentos de uma campanha
- A desativação de uma campanha precisa impedir que ela seja usada depois (vai ser consultada por um sistema de telefonia)

Endpoints esperados:
- `POST /campanhas` — cria campanha
- `GET /campanhas` — lista campanhas (com filtro por status)
- `GET /campanhas/:id` — detalha uma campanha
- `PATCH /campanhas/:id` — edita nome/status (inclui ativar/desativar)
- `DELETE /campanhas/:id` — remove campanha
- `POST /campanhas/:id/documentos` — upload de documento (multipart)
- `DELETE /campanhas/:id/documentos/:docId` — remove documento

**Tarefa 2 — Pipeline de Indexação RAG por campanha**
Quando um documento é enviado (Tarefa 1), ele precisa ser processado:
- Fazer chunking do documento (tamanho e overlap configuráveis)
- Gerar embeddings e indexar no watsonx, marcando cada chunk com o `campanha_id` para isolamento
- Cada campanha tem um índice isolado — uma busca numa campanha nunca pode retornar chunks de outra
- O status de indexação de cada documento (`processando` / `pronto` / `erro`) precisa ser consultável via API
- Remover um documento precisa remover os chunks dele do índice, sem afetar os demais documentos da mesma campanha

### Stack obrigatória (decisões já tomadas, não sugerir alternativas)

- **Runtime:** Node.js (versão LTS atual) com ES Modules
- **Framework:** Express
- **Banco de dados:** PostgreSQL
- **ORM:** Prisma
- **Upload de arquivos:** Multer
- **Documentação da API:** Swagger / OpenAPI, usando `swagger-ui-express` + `swagger-jsdoc`, com a UI servida em `/api-docs`
- **Validação de entrada:** Zod
- **Testes:** Jest + Supertest
- **Variáveis de ambiente:** dotenv
- **Fila de indexação:** para o MVP, pode ser processamento assíncrono simples em memória (sem Redis/SQS). Deixar a arquitetura pronta para trocar por fila real depois.
- **Cliente watsonx:** assuma que existe um módulo cliente que expõe funções `indexChunks(campanhaId, chunks)`, `search(campanhaId, query)` e `deleteDocumentChunks(campanhaId, documentoId)`. Não precisa implementar a integração real do watsonx agora — só a interface e um mock para desenvolvimento.

### Requisitos de organização (importante)

- Estrutura de pastas clara, separando rotas, controllers, services, repositories e middlewares
- Camada de service isolada da camada HTTP (controllers finos, lógica nos services)
- A lógica de RAG (Tarefa 2) tem que ficar desacoplada da API HTTP (Tarefa 1) — a API dispara o pipeline, mas não conhece os detalhes de chunking/embedding
- Tratamento de erros centralizado (middleware de erro)
- Todo endpoint documentado no Swagger com request/response schemas
- Configuração via variáveis de ambiente, com um `.env.example`

### Restrições do projeto (competição IBM)

- Nenhum dado pessoal de usuário é tratado por esta API (campanhas e documentos didáticos apenas)
- Validação de upload: aceitar somente PDF e TXT, com tamanho máximo configurável por variável de ambiente

### O que eu quero nesta primeira resposta (SOMENTE O PLANO)

1. **Estrutura de pastas completa** do projeto, com uma linha explicando o papel de cada pasta/arquivo principal
2. **Modelagem do banco** (schema Prisma): tabelas `Campanha` e `Documento`, com campos, tipos e relações. Explique o campo de status de indexação.
3. **Lista dos endpoints** com o formato de request e response de cada um (incluindo códigos de status e casos de erro)
4. **Desenho do pipeline de indexação**: como o upload dispara o processamento, como o status é atualizado, como o isolamento por campanha é garantido, e como a remoção de chunks funciona
5. **Ordem de implementação recomendada** — em que sequência eu devo construir as coisas para ter o sistema testável o quanto antes (quais partes primeiro, o que pode ser mockado no começo)
6. **Pontos de atenção e riscos** que você antevê nessa arquitetura

Depois que eu revisar e aprovar esse plano, vou te pedir para implementar parte por parte. Não adiante código agora. Se alguma coisa do contexto estiver ambígua, liste suas suposições no começo da resposta antes do plano.

---

## Como usar depois do plano

Quando o Bob devolver o plano e você aprovar, os próximos prompts podem ser, nesta ordem:

1. *"Aprovado. Comece pela modelagem: gere o `schema.prisma` completo e o `.env.example`."*
2. *"Agora gere a estrutura base do Express: app, servidor, middleware de erro e configuração do Swagger em `/api-docs`."*
3. *"Implemente o CRUD de campanhas: rotas, controller, service e repository, com a documentação Swagger de cada endpoint."*
4. *"Implemente o upload e a remoção de documentos com Multer e a validação de PDF/TXT."*
5. *"Implemente o pipeline de indexação RAG com o cliente watsonx mockado, incluindo o controle de status e o isolamento por campanha."*
6. *"Gere os testes com Jest + Supertest para o CRUD de campanhas e para o fluxo de upload → indexação."*

Peça uma etapa de cada vez. Revise o código de cada etapa antes de pedir a próxima — assim o Bob mantém o contexto correto e você não acumula erros.

## Dica de uso do Bob

- Se o Bob começar a gerar código mesmo você pedindo só o plano, responda: *"Ainda não quero código, só o plano. Reescreva sem código."*
- Se uma resposta vier grande demais e cortada, peça: *"Continue de onde parou."*
- Sempre que ele assumir algo que você não concorda, corrija explicitamente antes de avançar — assistentes de código carregam as suposições para as próximas respostas.
