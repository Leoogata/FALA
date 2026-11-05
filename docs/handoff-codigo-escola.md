# Handoff — Código por escola + agente geral

Contexto: adicionamos o conceito de **escola** com **código digitado no telefone**. O aluno liga, (opcionalmente) digita o código da escola, e passa a ver apenas as campanhas daquela escola. Sem código, vê o conteúdo "geral".

Este documento descreve **o que o backend já entrega** e **o que falta nas outras camadas** (telefonia e watsonx) para o fluxo fechar.

---

## O que o backend já faz (pronto)

**Modelo de dados** (migration `20241105000005_add_escolas`):
- Nova tabela `escolas` (`id`, `codigo` único, `nome`).
- `campanhas` ganhou `escola_id` (nullable — null = campanha "geral").
- `slug` deixou de ser único global; agora é único **por escola** (`@@unique([escolaId, slug])`). Isso permite que duas escolas tenham cada uma a sua "matemática", e **destrava criar matérias novas** como "informatica".

> ⚠️ Rodar no Supabase (SQL Editor): a migration está em `prisma/migrations/20241105000005_add_escolas/migration.sql`. Aplicar manualmente (pooler não roda migrate; conexão direta é IPv6-only). Depois `npx prisma generate` + `node prisma/seed.js`.

**Endpoints:**
- `GET /escolas/:codigo` → resolve o código digitado e retorna `{ id, codigo, nome }` (404 se não existir). **A URA usa isso.**
- `GET /campanhas/ativas?escola=<codigo>` → campanhas ativas **daquela escola**, no formato do orquestrador `{ campanhaId, nome, descricao }`.
- `GET /campanhas/ativas` (sem `?escola`) → campanhas **gerais** (sem escola).

**Seed** (`prisma/seed.js`):
- Escola `1001` — E.E. Castelo Branco → Informática, Matemática, Português.
- Escola `2002` — E.E. Maria Montessori → História, Geografia, Ciências.
- 5 campanhas gerais (sem escola) para o fluxo sem código.

---

## O que falta — TELEFONIA (telephony-handler)

**1. Capturar o código na URA (`<Gather input="dtmf">`).**
No `incomingHandler` / `voice/incoming`, antes de pedir a pergunta, oferecer:
> "Se você tem o código da sua escola, digite agora. Ou aguarde para continuar."

Usar `<Gather input="dtmf" numDigits="4" timeout="...">`. O código digitado chega em `req.body.Digits`.

**2. Resolver o código e guardar a escola na sessão da chamada.**
- Com dígitos: chamar `GET {BACKEND_API_URL}/escolas/<digits>`. Se 200, guardar o `codigo` (ou `id`) no `callSession` associado ao `CallSid`. Se 404, avisar ("código não encontrado") e seguir no fluxo geral.
- Sem dígitos (timeout): segue no fluxo geral.

**3. Passar a escola ao buscar campanhas.**
No `turnHandler`, onde hoje chama `campanhas.getCampanhasAtivas()`, passar o código da sessão: `getCampanhasAtivas(codigoEscolaDaSessao)` → que deve chamar `GET /campanhas/ativas?escola=<codigo>`. Sem código na sessão, chama sem o parâmetro (geral). O `campanhas.js` do handler precisa aceitar esse argumento opcional.

---

## O que falta — WATSONX (agente geral)

Este é o ponto que **destrava o conteúdo dinâmico** (informática, e qualquer matéria nova por escola). Hoje há **um deployment watsonx por matéria** (`WATSONX_AGENT_ID_HISTORIA`, etc.), então uma matéria nova como "informatica" **não tem agente** e o `resolveAgentId` quebra.

**Mudança necessária: trocar os 5 agentes fixos por UM agente educacional geral, parametrizado.**
- O agente recebe: a matéria (slug/nome), as **instruções** da campanha (o `descricao`, que é o system prompt) e o **contexto RAG** (já injetado via `/rag/search`).
- Responde no mesmo contrato atual: `{ resposta, confianca, sem_resposta }`.
- Assim, qualquer campanha de qualquer escola funciona **sem deployar nada novo**.

**No orquestrador:** soltar o `enum` fixo (`historia|geografia|...`) do `schema.json` e do prompt. Ele deve rotear **a partir da lista `campanhasAtivas` que recebe** (que agora varia por escola), não de uma lista fixa. O prompt revisado em `docs/` (integração-agente) já fazia isso — aplicar.

> Enquanto o agente geral não existir: o backend e a telefonia já funcionam, mas o agente só responde bem as 5 matérias que têm deployment. Informática e campanhas por escola roteiam mas falham no subagente.

---

## Fluxo completo (quando tudo estiver pronto)

1. Aluno liga → "digite o código da escola, ou aguarde".
2. Digita `1001` → handler resolve via `GET /escolas/1001` → guarda escola na sessão.
3. Aluno pergunta → handler busca `GET /campanhas/ativas?escola=1001` → só Informática/Matemática/Português.
4. Orquestrador (lista dinâmica) roteia → agente geral responde com RAG da campanha certa.
5. Sem código: passos 3-4 usam as campanhas gerais.

## Como demonstrar o isolamento

Ligar e digitar `1001` → perguntar de informática → responde. Ligar de novo, digitar `2002` → perguntar de informática → **não tem essa matéria** (fallback), mas história sim. Prova que o código leva a conteúdos diferentes.
