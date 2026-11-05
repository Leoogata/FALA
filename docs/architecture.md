# Arquitetura e funcionamento atual

Referência do código existente em 05/11/2026. A configuração dos ambientes externos não foi comprovada nesta documentação; veja [pendências](pendencias.md).

## Serviços

| Componente | Implementação | Execução local |
| --- | --- | --- |
| Painel escolar | React, TypeScript, Vite, TanStack Query e Tailwind | `frontend/`, normalmente porta 5173 |
| API | Node.js, Express, módulos ES, Zod e Prisma | `backend/`, porta padrão 3001 |
| Voz | Node.js, Express e CommonJS | `backend/telephony-handler/`, porta padrão 3000 |
| Banco | PostgreSQL | Configurado por `DATABASE_URL`; migrations usam `DIRECT_URL` |
| IA | Templates implantados no watsonx.ai | IDs configurados no serviço de voz |

Os dois serviços Node têm dependências e testes separados. No Compose, o backend escuta internamente em 3000 e é exposto no host em 3001.

## Fluxo de uma ligação

1. O provedor chama `POST /voice/incoming`. O handler identifica a ligação, cria/recupera uma conversa pela API e emite um token para a captura de voz.
2. O aluno fala livremente. O Twilio envia transcrição e confiança a `POST /voice/turn?turno_token=...`.
3. O handler valida a fala, sanitiza a pergunta, reserva o turno no banco e recupera as trocas anteriores.
4. `GET /campanhas/ativas` fornece as campanhas que têm matéria e descrição configuradas. O orquestrador recebe a pergunta e o histórico para escolher a matéria ou pedir esclarecimento.
5. O cliente educacional busca contexto em `/rag/search` e envia a pergunta, o contexto disponível e o histórico ao subagente da matéria.
6. O resultado é confirmado no banco antes da resposta de voz. O handler usa áudio ElevenLabs quando disponível e `<Say>` com Polly como fallback.
7. Uma nova captura permite continuar a conversa. Tecla, callback de término ou inatividade encerram a conversa.

Não há menu inicial de matérias: a classificação é feita pelo orquestrador.

## Campanha, matéria e agente

- `Campanha.id` é o identificador real do banco, usado no CRUD, documentos e associação de interações.
- `Campanha.slug` identifica a matéria: `historia`, `geografia`, `portugues`, `matematica` ou `ciencias`.
- No JSON dos agentes, `campanhaId` significa esse slug. A resposta de `/campanhas/ativas` contém também `id` para o handler não confundir as duas identificações.
- O nome de uma turma pode ser personalizado; não é a chave de roteamento.
- As instruções editadas no painel ficam em `Campanha.descricao`. A resposta do painel usa o alias `instrucoes`; elas ainda não são sincronizadas automaticamente com os prompts implantados na IBM.

## Documentos e RAG

O upload persiste o arquivo localmente e cria um `Documento` em `PROCESSANDO`. Uma fila em memória executa extração de TXT/PDF, OCR de apoio, divisão de texto e indexação pelo cliente RAG. O status passa para `PRONTO` ou `ERRO`.

Os chunks são isolados pelo ID real da campanha. A busca HTTP aceita ID ou slug e resolve o ID antes de consultar o índice.

O pipeline e a busca existem, mas o armazenamento vetorial remoto não está implementado em `backend/src/rag/watsonxClient.js`. Com `WATSONX_MOCK=true`, os chunks ficam em memória e desaparecem ao reiniciar o processo. O status `PRONTO` nesse modo não comprova indexação remota.

## Conversas e análise

O banco tem `Campanha`, `Documento`, `Conversa` e `Interacao`. Perguntas e respostas são guardadas por ligação, em ordem, com vencimento de 168 horas por interação. O contexto dos agentes usa até cinco trocas recentes.

O handler associa a ligação por HMAC do `CallSid`; o identificador original não é um campo persistido do histórico atual. Isso é pseudonimização da associação: a sanitização de texto é heurística e não garante anonimização completa.

Os endpoints de analytics consultam o mesmo histórico, por matéria ou ID da campanha, e excluem interações vencidas ou ainda em processamento. Não há uma tela de analytics implementada no painel atual.

A rotina de expurgo e encerramento por inatividade está no processo da API. Execução independente, backups e outros limites estão no [backlog](pendencias.md).

## Referências de implementação

- [Schema e relações](../backend/prisma/schema.prisma).
- [Rotas da API](../backend/src/routes/index.js).
- [Ciclo de voz](../backend/telephony-handler/src/handlers/turnHandler.js).
- [Memória](contracts/conversa.md).
- [Interface RAG](contracts/watsonx-client.md).
- [Prompts dos agentes](../watsonx/agent-educational/system-prompt.md).
