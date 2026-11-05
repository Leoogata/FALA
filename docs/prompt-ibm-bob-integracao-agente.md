# Prompt para o IBM Bob — Integração Backend ↔ Agente de Voz

Este prompt pede ao Bob um **plano primeiro** (sem código) para corrigir os pontos de desalinhamento entre o backend de campanhas (US-04/05) e o handler de voz + agente (US-08). Depois de aprovado, implementação em etapas.

Cobre **dois projetos**: `backend/` (API de campanhas) e `backend/telephony-handler/` (cliente que consome a API). São apps Node.js separados no mesmo repositório.

Copie tudo a partir da linha abaixo.

---

## PROMPT

Você é um engenheiro de backend sênior. Preciso conciliar dois serviços Node.js de um mesmo projeto que foram construídos por pessoas diferentes e não se encaixam na integração. **Nesta primeira resposta, NÃO escreva código — quero o plano de correção para revisar.** Só codamos depois que eu aprovar.

### Contexto

Dois serviços Express independentes no mesmo repositório:

- **`backend/`** — API de campanhas e documentos (PostgreSQL + Prisma + Zod + Swagger). Modelo `Campanha` tem `id` gerado como **cuid** (ex.: `clx1abc2def3`), `nome`, `descricao` (opcional), `ativa` (boolean), timestamps, e relação 1:N com `Documento` (que tem `statusIndexacao` enum PROCESSANDO/PRONTO/ERRO).
- **`backend/telephony-handler/`** — handler de voz (Twilio) que, a cada turno de ligação, busca as campanhas ativas na API acima, chama um agente orquestrador watsonx para rotear a pergunta para uma matéria, chama o subagente da matéria, e devolve TwiML. Usa CommonJS (`require`), axios.

### Os desalinhamentos a corrigir

**Desalinhamento 1 — rota inexistente.**
O handler (`backend/telephony-handler/src/services/campanhas.js`) chama `GET {BACKEND_API_URL}/campanhas/ativas`. Essa rota **não existe** no `backend/` — lá só existe `GET /campanhas?ativa=true`. Resultado: 404, e o roteamento inteiro falha.

**Desalinhamento 2 — formato de campanha incompatível.**
O orquestrador espera cada campanha como `{ campanhaId, nome, descricao }`. O `backend/` retorna `{ id, nome, descricao, ativa, criadaEm, _count }`. O campo de ID tem nome diferente (`id` vs `campanhaId`) e há campos extras. O schema do agente usa `additionalProperties: false`, então campos extras podem ser rejeitados.

**Desalinhamento 3 — identificador semântico vs. cuid (o mais importante).**
O agente identifica campanhas por um **enum fixo de slugs**: `historia`, `geografia`, `portugues`, `matematica`, `ciencias`. O `backend/` identifica campanhas por **cuid aleatório**. O orquestrador retorna um desses slugs, e o handler usa esse slug para escolher qual subagente watsonx chamar (via as envs `WATSONX_AGENT_ID_<MATERIA>`). Um cuid nunca vai casar com esse enum.

### Decisão de arquitetura já tomada (seguir exatamente — não propor alternativas)

Vamos adotar o **modelo de matérias fixas via um campo `slug`**, SEM destruir o modelo dinâmico atual do backend:

- Adicionar ao modelo `Campanha` um campo **`slug`** (string, único, nullable por enquanto). Os valores válidos são exatamente: `historia`, `geografia`, `portugues`, `matematica`, `ciencias`.
- O `id` (cuid) **continua existindo e sendo a PK** — não remover, não quebrar nada que já usa `id`. O `slug` é um identificador adicional, semântico, usado SOMENTE na integração com o agente.
- Para a demo, existirão 5 campanhas, uma por slug. Um seed deve criá-las.

Isso resolve o Desalinhamento 3 sem jogar fora o CRUD dinâmico existente.

### O que cada lado precisa mudar

**No `backend/`:**
1. Migração Prisma: adicionar `slug` (único, nullable) ao modelo `Campanha`. Preservar dados existentes.
2. Permitir definir `slug` na criação/edição de campanha (validação Zod: se presente, deve ser um dos 5 valores válidos).
3. Criar a rota **`GET /campanhas/ativas`** que retorna APENAS campanhas com `ativa = true` E que tenham `slug` preenchido, no formato exato que o orquestrador espera: um array de `{ campanhaId, nome, descricao }` — onde `campanhaId` é o **`slug`** (não o cuid), `nome` é o nome, `descricao` é a descricao. Excluir do retorno campanhas sem `descricao` (o orquestrador precisa dela para classificar).
4. Seed: criar as 5 campanhas fixas (uma por slug) com nome e descricao adequados, todas ativas.
5. Atualizar Swagger da nova rota.

**No `backend/telephony-handler/`:**
6. Confirmar que `campanhas.js` consome `GET /campanhas/ativas` e que o formato retornado bate com o que `orchestrator.routeQuestion` espera (`{ campanhaId, nome, descricao }`). Ajustar se necessário.
7. Garantir que o `campanhaId` (slug) devolvido pelo orquestrador é o que `agentEducational.resolveAgentId` usa para achar a env `WATSONX_AGENT_ID_<MATERIA>` — confirmar que o mapeamento slug → env está correto.

### Restrições

- Não quebrar nenhum teste nem endpoint existente do `backend/` que usa `id` (cuid). O `slug` é aditivo.
- Não alterar a lógica interna dos agentes watsonx (prompts, deployment) — isso é de outra pessoa. Mexa apenas no cliente HTTP do handler se o formato não bater.
- Manter as camadas do `backend/` (routes → controllers → services → repositories).

### O que quero nesta primeira resposta (SOMENTE O PLANO)

1. **Migração**: como adicionar `slug` sem perder dados, e por que nullable primeiro.
2. **Mudanças no `backend/`**: lista de arquivos tocados (schema, migration, repository, service, controller, schema Zod, nova rota, seed, swagger) e o que muda em cada um.
3. **Rota `GET /campanhas/ativas`**: a query Prisma exata (filtro `ativa=true` + `slug` não nulo + `descricao` não nula) e o mapeamento para `{ campanhaId: slug, nome, descricao }`.
4. **Seed**: o conteúdo das 5 campanhas fixas (nome + descricao de cada matéria).
5. **Mudanças no `telephony-handler/`**: o que (se algo) precisa mudar em `campanhas.js` e no mapeamento slug → env.
6. **Impacto nos testes** dos dois serviços: o que quebra e o que precisa ser adicionado.
7. **Ordem de implementação** e **riscos**.

Se algo estiver ambíguo, liste suas suposições antes do plano. Não escreva código ainda.

---

## Sequência de prompts após o plano aprovado

1. *"Aprovado. Comece pela migração do backend: adicione `slug` único nullable ao modelo Campanha, preservando dados."*
2. *"Atualize os schemas Zod e o service/controller de campanhas para aceitar e validar `slug` (um dos 5 valores) na criação e edição."*
3. *"Crie a rota GET /campanhas/ativas com a query e o mapeamento para `{campanhaId: slug, nome, descricao}`, e documente no Swagger."*
4. *"Crie o seed das 5 campanhas fixas (historia, geografia, portugues, matematica, ciencias) com nome e descricao."*
5. *"Ajuste o cliente campanhas.js do telephony-handler, se necessário, para consumir a rota e bater com o formato do orquestrador."*
6. *"Atualize e adicione os testes dos dois serviços."*

Peça uma etapa de cada vez e revise antes de avançar.

## Observações para você (não enviar ao Bob)

- **Pendência que este prompt NÃO resolve:** a US-09 (`backend/analytics`) ainda é só README — não existe código. O handler chama `POST /interacoes` num serviço que não roda. Enquanto a US-09 não for implementada, o `registrarInteracao` vai falhar silenciosamente (é fire-and-forget, então não derruba a ligação, mas não grava nada). Vale um prompt separado para a US-09.
- **Pendência que este prompt NÃO resolve:** o RAG (`search`) está marcado como POSTERGADO no agente — os subagentes respondem pelo conhecimento do modelo, não pelo seu índice. Sua US-05 está pronta mas sem consumidor. Quando os materiais didáticos chegarem, será preciso ligar o agente ao seu `search`.
- O `slug` ser nullable deixa a porta aberta para o modelo dinâmico voltar depois da competição sem outra migração destrutiva.
