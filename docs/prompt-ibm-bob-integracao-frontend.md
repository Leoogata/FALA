# Prompt para o IBM Bob — Integração Frontend ↔ Backend ponta a ponta

Pede ao Bob um **plano de verificação e correção primeiro** (sem código). O objetivo é fazer o fluxo completo funcionar: abrir o painel web → criar agente → subir material → editar instruções → testar → e o agente atender por telefone. Boa parte já existe; o trabalho é achar e fechar as lacunas.

Copie a partir da linha abaixo.

---

## PROMPT

Você é um engenheiro full-stack sênior. Tenho um projeto com três partes que precisam funcionar juntas de ponta a ponta, e preciso que você verifique a integração, encontre as lacunas e as conserte. **Nesta primeira resposta, NÃO escreva código — faça um plano de verificação: liste o que checar em cada ponto de contato, o que provavelmente está quebrado, e como corrigir.** Só codamos depois que eu aprovar.

### Arquitetura

Três serviços no mesmo repositório:

- **`backend/`** — API REST (Node.js/Express, ESM, Prisma/PostgreSQL-Supabase, porta 3001). Expõe `/campanhas` (CRUD + `/ativas`), `/campanhas/:id/documentos` (upload/lista/remoção), `/instrucoes/melhorar`, `/campanhas/:id/testar`, `/interacoes`, `/analytics`, `/rag/search`, e `/api-docs` (Swagger). Tem um `serializers/campanha.serializer.js` que converte o camelCase do Prisma para o **snake_case** que o frontend espera.
- **`frontend/`** — painel web React/TypeScript/Vite (porta 5173). Camada de API em `src/api/` (`agentes.ts`, `materiais.ts`, `instrucoes.ts`, `testar.ts`), com um modo mock (`VITE_USE_MOCK`). Base URL em `VITE_API_URL`.
- **`backend/telephony-handler/`** — handler de voz Twilio (porta 3000). Já funciona: recebe ligação, roteia por agente (orquestrador watsonx), responde via subagente + ElevenLabs TTS, registra interação.

### O que já está feito (NÃO refazer)

- Backend tem todas as rotas acima implementadas e testadas (34 testes passando).
- O serializer já mapeia `criadaEm → criada_em`, `nomeOriginal → nome_original`, calcula `docs: {pronto, processando, erro}`, e expõe `instrucoes` (alias de `descricao`). Foi escrito contra `frontend/src/api/types.ts`.
- O frontend tem todas as telas e a camada de API prontas, com fallback mock.
- O handler de voz consome `/campanhas/ativas` e funciona.

### O que verificar e corrigir (o foco deste trabalho)

**1. Alinhamento de contrato campo a campo.** Para cada endpoint que o frontend chama (`src/api/*.ts`), confirme que a resposta REAL do backend bate exatamente com o tipo TypeScript em `src/api/types.ts`. Pontos de atenção conhecidos:
   - O front espera snake_case (`criada_em`, `nome_original`, `status_indexacao` em minúsculo, `docs`); confirme que o serializer cobre TODOS os endpoints, não só alguns. Em especial: a resposta do `PATCH /campanhas/:id`, do `POST /campanhas/:id/documentos` (upload) e do `GET /campanhas/:id/documentos` (lista) — todos devem passar pelo serializer de `Material`.
   - O front espera `tamanho_bytes` em `Material`; confirme se o backend persiste e serializa isso (pode estar sempre null).
   - O `DELETE /campanhas/:id/documentos/:docId` deve retornar `{ campanha_ativa: boolean }` (o front usa isso). Confirme o formato.

**2. Formato de erro.** O `client.ts` do front aceita tanto `{ error }` (backend) quanto `{ erro, mensagem }`. Confirme que o backend sempre responde erros em JSON com `error`, e que os códigos HTTP batem com o que o front trata (400, 404, 409, 413, 415, 422).

**3. Base URL e porta.** O `frontend/.env.example` aponta `VITE_API_URL=http://localhost:3000`, mas o backend roda na **3001** (a 3000 é o telephony-handler). Isso está errado e faria o front bater no serviço errado. Corrija o `.env.example` do front para `3001` e documente.

**4. CORS.** O front (5173) chama o backend (3001) de outra origem. Confirme que o backend tem CORS habilitado para a origem do front; se não tiver, adicione (`cors` no Express, permitindo `http://localhost:5173` em dev).

**5. Os endpoints 8 e 9 (`/instrucoes/melhorar` e `/campanhas/:id/testar`).** Confirme se estão implementados de verdade ou ainda são stub. O front os consome esperando `{texto_sugerido, mudancas[], premissas[]}` e `{resposta, confianca, sem_resposta}` respectivamente. Se forem stub, tudo bem para a demo — mas documente o que falta para ligá-los ao watsonx real.

**6. Fluxo completo manual.** Descreva o passo a passo para testar tudo junto rodando (backend 3001 + front 5173 + handler 3000, com `VITE_USE_MOCK=false`): criar agente → definir instruções → subir um PDF → ver status virar "pronto" → testar pergunta → confirmar que aparece em `/campanhas/ativas` → ligar e ser atendido.

### Restrições

- Não quebrar os 34 testes existentes do backend nem as telas do front.
- Não mexer na lógica interna dos agentes watsonx (prompts/deployment).
- Manter o modo mock do front funcionando (não removê-lo).
- Credenciais ficam em `.env` (nunca commitar); só mexer em `.env.example`.

### O que quero nesta primeira resposta (SOMENTE O PLANO)

1. **Matriz de contrato**: tabela com cada endpoint, o que o front envia/espera, o que o backend realmente retorna, e se batem ou não.
2. **Lista de correções** necessárias, por arquivo, em ordem de prioridade (o que bloqueia o fluxo primeiro).
3. **Correção do `.env.example` e CORS** — os dois itens que provavelmente bloqueiam a primeira requisição real.
4. **Roteiro de teste manual ponta a ponta** (o passo 6 acima).
5. **Riscos** — o que pode falhar silenciosamente (ex: upload sem CORS, porta errada, status em caso errado).

Se algo estiver ambíguo, liste suas suposições antes do plano. Não escreva código ainda.

---

## Sequência após o plano aprovado

1. *"Corrija o `.env.example` do front (porta 3001) e adicione CORS no backend para localhost:5173."*
2. *"Garanta que todos os endpoints de documento passam pelo serializer de Material (upload, lista, detalhe)."*
3. *"Alinhe os formatos que divergirem da matriz de contrato — um endpoint por vez."*
4. *"Implemente de verdade (ou deixe stub documentado) /instrucoes/melhorar e /campanhas/:id/testar."*
5. *"Rode o fluxo manual ponta a ponta e me diga onde quebra."*

Peça uma etapa de cada vez.

## Nota (não enviar ao Bob)

Pontos que descobri e que o Bob deve confirmar — não assuma que estão certos:
- O serializer existe mas pode não cobrir o caminho de upload/lista de Material. Esse é o furo mais provável.
- `VITE_API_URL` apontando pra 3000 (handler) em vez de 3001 (backend) é bug certo.
- CORS quase certamente ainda não está configurado — front e backend em portas diferentes = requisição cross-origin bloqueada. É o primeiro muro que você vai bater ao testar.
