# Prompt para o IBM Bob — Alinhamento dos Endpoints com o Frontend

Este prompt pede ao Bob um **plano de implementação primeiro** (sem código), para ajustar o backend existente aos endpoints que a pessoa de frontend especificou. Depois de você aprovar o plano, pede-se o código em etapas.

Copie tudo a partir da linha abaixo.

---

## PROMPT

Você é um engenheiro de backend sênior. Estou trabalhando num backend Node.js + Express já existente e preciso alinhá-lo a uma lista de endpoints que a pessoa de frontend do meu time especificou. **Nesta primeira resposta, NÃO escreva código — quero apenas o plano de implementação do delta, para eu revisar.** Só vamos codar depois que eu aprovar.

### Estado atual do backend (já implementado e testado)

Stack: Node.js (ES Modules) · Express · PostgreSQL · Prisma · Multer · Zod · Swagger (swagger-jsdoc em `/api-docs`) · Jest + Supertest.

Arquitetura em camadas: `routes → controllers → services → repositories`. Pipeline de RAG desacoplado via fila em memória. Cliente watsonx abstraído atrás de uma interface (`watsonxClient`) com um mock em memória controlado pela env `WATSONX_MOCK`.

Modelos Prisma atuais:
- **Campanha**: `id` (cuid), `nome`, `descricao` (opcional), `ativa` (default false... confirmar — ver ponto abaixo), `criadaEm`, `atualizadaEm`, relação 1:N com Documento.
- **Documento**: `id` (cuid), `campanhaId`, `nomeOriginal`, `mimeType`, `caminhoArquivo`, `statusIndexacao` (enum PROCESSANDO/PRONTO/ERRO), `erroIndexacao` (opcional), `criadoEm`, `atualizadoEm`.

Endpoints que já existem:
- `POST /campanhas`, `GET /campanhas?ativa=`, `GET /campanhas/:id`, `PATCH /campanhas/:id`, `DELETE /campanhas/:id` (com `?cascade=true`)
- `POST /campanhas/:id/documentos`, `GET /campanhas/:id/documentos`, `GET /campanhas/:id/documentos/:docId`, `DELETE /campanhas/:id/documentos/:docId`

### O que a pessoa de frontend especificou

| # | Método | Rota | Envia | Recebe | Usado em |
|---|--------|------|-------|--------|----------|
| 1 | GET | `/campanhas?ativa=` | — | Lista com `id, nome, ativa, atualizada_em` e contagem docs `{pronto, processando, erro}` | Lista de agentes. A URA (US-07) usa a mesma rota com `?ativa=true` |
| 2 | POST | `/campanhas` | `{nome, instrucoes?}` | Campanha criada com `ativa = false` | Etapa 1 do formulário |
| 3 | GET | `/campanhas/:id` | — | Campanha com seus documentos | Detalhe do agente |
| 4 | PATCH | `/campanhas/:id` | `{nome?, instrucoes?, ativa?}` | Campanha atualizada, ou **422** se tentar ativar sem documento pronto ou sem instruções | Toggle, aba Instruções, revisão |
| 5 | POST | `/campanhas/:id/documentos` | Arquivo (multipart) | Documento com status `processando`. Erros: **415** (formato), **413** (tamanho), **409** (mesmo nome de arquivo já enviado) | Upload |
| 6 | GET | `/campanhas/:id/documentos` | — | Documentos com status e mensagem de erro | Polling a cada 3–5 s |
| 7 | DELETE | `/campanhas/:id/documentos/:docId` | — | `{campanha_ativa}` | Remover com confirmação; o front usa a resposta para avisar se o agente foi desativado |
| 8 | POST | `/instrucoes/melhorar` | `{nome, instrucoes}` | `{texto_sugerido, mudancas[], premissas[]}` | Botão "Melhorar com IA". Não grava nada |
| 9 | POST | `/campanhas/:id/testar` | `{pergunta}` | `{resposta, confianca, sem_resposta}` | Aba Testar. Não grava nada |
| 10 | DELETE | `/campanhas/:id` | — | 204 | Já existe, nenhuma tela usa |

### Decisões já tomadas (não sugerir alternativas)

1. **Renomear `descricao` → `instrucoes`** em todo o backend (schema Prisma, migração, repository, service, controller, schemas Zod, Swagger). O campo `instrucoes` é o prompt/comportamento do agente.

2. **Endpoints 8 e 9 ficam como STUB nesta fase.** Eles dependem do agente watsonx (US-08), que outra pessoa do time está construindo. Implemente as rotas com o **formato de resposta correto**, mas retornando dados fixos/placeholder — sem lógica real de IA. Deixe um comentário `// TODO US-08` claro e um ponto de integração óbvio (ex.: chamar `watsonxClient.melhorarInstrucoes(...)` / `watsonxClient.testar(...)` que por ora lançam "não implementado"). O objetivo é desbloquear o frontend contra o formato, não entregar a IA.

3. **Padronização dos códigos HTTP de upload (endpoint 5):**
   - Tipo de arquivo inválido (não PDF/TXT) → **415** (hoje está 400)
   - Tamanho excedido → **413** (hoje está 400)
   - Nome de arquivo já enviado na mesma campanha → **409** (novo — hoje não existe)

4. **Contagem de documentos (endpoint 1):** mudar de `_count: { documentos }` (número) para um objeto `docs: { pronto, processando, erro }` com a contagem por status.

5. **Resposta do DELETE de documento (endpoint 7):** além de remover, retornar `{ campanha_ativa: boolean }`. Se a remoção deixar a campanha sem nenhum documento `PRONTO`, a campanha deve ser **desativada automaticamente** (`ativa = false`), e a resposta reflete isso. Mudar de 204 para **200** com corpo `{ campanha_ativa }`.

### Regras de negócio novas (atenção especial)

**Regra de ativação (endpoint 4 — a mais importante):**
Ao receber `PATCH` com `ativa: true`, a campanha só pode ser ativada se:
- tiver `instrucoes` preenchidas (não nula/vazia), E
- tiver pelo menos um documento com `statusIndexacao = PRONTO`.

Se qualquer condição falhar, retornar **422** com uma mensagem clara dizendo o que falta. Essa regra vale só para ativação — desativar (`ativa: false`) é sempre permitido.

**Criação sempre inativa (endpoint 2):**
`POST /campanhas` sempre cria com `ativa = false`, independente do que venha no body. A campanha só é ativada depois, via PATCH, quando cumprir a regra de ativação acima. Confirme se o default do schema Prisma precisa mudar.

**Desativação automática em cascata (endpoint 7):**
Quando um documento é removido, verificar se a campanha ainda tem algum documento `PRONTO`. Se não tiver e a campanha estiver ativa, desativá-la. A resposta `{ campanha_ativa }` informa o front.

### O que eu quero nesta primeira resposta (SOMENTE O PLANO)

1. **Diff de cada endpoint**: para cada um dos 10, diga se é "já existe e não muda", "já existe mas muda X", ou "novo". Para os que mudam, descreva exatamente o quê.
2. **Migração do banco**: o que muda no schema Prisma (renomear `descricao → instrucoes`, default de `ativa`, qualquer índice necessário para a regra de nome duplicado) e como a migração deve ser escrita para não perder dados existentes.
3. **Onde cada regra de negócio nova mora**: em qual service/função ficam a regra de ativação, a desativação automática e a contagem por status. Mantenha a lógica nos services, não nos controllers.
4. **Impacto nos testes existentes**: quais dos testes atuais vão quebrar com essas mudanças (ex.: testes que esperam 400 no upload, ou 204 no delete de documento) e precisam ser atualizados.
5. **Novos testes necessários**: liste os casos de teste novos (regra de ativação 422, desativação automática, 409 de nome duplicado, 415/413, stubs dos endpoints 8 e 9).
6. **Ordem de implementação** recomendada, do menor risco ao maior.
7. **Pontos de atenção / riscos** que você antevê.

Se algo do contexto estiver ambíguo, liste suas suposições antes do plano. Não escreva código ainda.

---

## Sequência de prompts após o plano aprovado

1. *"Aprovado. Comece pela migração: renomeie `descricao → instrucoes`, ajuste o default de `ativa` para false, e gere a migration preservando dados. Atualize o schema Prisma."*
2. *"Atualize os schemas Zod e o CRUD de campanhas para o novo campo `instrucoes` e a resposta de contagem `docs: {pronto, processando, erro}` no endpoint 1."*
3. *"Implemente a regra de ativação no service de campanhas: PATCH com `ativa: true` retorna 422 se faltar instruções ou documento PRONTO."*
4. *"Ajuste os códigos HTTP do upload: 415 para formato, 413 para tamanho, 409 para nome duplicado na mesma campanha."*
5. *"Implemente a desativação automática e a resposta `{campanha_ativa}` no DELETE de documento."*
6. *"Crie os endpoints 8 e 9 como stub, com o formato de resposta correto e um ponto de integração marcado com `// TODO US-08`."*
7. *"Atualize os testes existentes que quebraram e adicione os testes novos: regra de ativação, desativação automática, 409/415/413 e os stubs."*
8. *"Atualize a documentação Swagger de todos os endpoints alterados e novos."*

Peça uma etapa de cada vez e revise o código antes de avançar.

## Lembrete sobre o contrato watsonx

Os endpoints 8 e 9 vão, no futuro, consumir o agente educacional (US-08) da outra pessoa do time. Quando for integrar de verdade, atualize `docs/contracts/watsonx-client.md` com as assinaturas de `melhorarInstrucoes` e `testar` — hoje o contrato só cobre `indexChunks`, `search` e `deleteDocumentChunks`.
