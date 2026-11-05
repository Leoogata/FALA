# Contrato atual — Conversas e histórico

Referência do código existente. A aplicação da migration no banco real e os controles ainda incompletos estão em [pendências](../pendencias.md).

## Identificação e armazenamento

- Uma ligação corresponde a uma `Conversa`; cada pergunta aceita corresponde a uma `Interacao`, com ordem e token de captura.
- O handler calcula HMAC do `CallSid` para associar a ligação sem persistir o identificador original no histórico atual.
- Perguntas e respostas passam por sanitização heurística. Esse tratamento não comprova anonimização completa.
- Os modelos e tipos efetivos estão em [schema.prisma](../../backend/prisma/schema.prisma). O ID de `Interacao` usa armazenamento textual para preservar IDs legados; identificadores de conversa e tokens usam UUID.
- `campanha_id` é a FK real; `materia` é o slug usado pelos agentes.

## Endpoints entre serviços

Exigem `Authorization: Bearer <INTERNAL_API_KEY>`.

| Operação | Rota |
| --- | --- |
| Criar/recuperar conversa por chave HMAC | `POST /internal/conversas` |
| Recuperar contexto recente | `GET /internal/conversas/:id/contexto` |
| Reservar pergunta com token | `POST /internal/conversas/:id/turnos` |
| Finalizar interação | `POST /interacoes` |
| Encerrar conversa | `PATCH /internal/conversas/:id` |

A reserva recebe `turno_token`, `pergunta` e `texto_suprimido`. A finalização recebe `conversa_id`, `turno_token`, resultado, campanha, matéria e métricas. Os campos e limites são definidos pelos [schemas Zod](../../backend/src/schemas/conversa.schema.js).

O mesmo `POST /interacoes` aceita o contrato legado com `call_sid` por um adaptador autenticado. Ele também grava na estrutura atual e não mantém uma segunda tabela de analytics.

## Contexto enviado aos agentes

O orquestrador recebe `{ pergunta, campanhasAtivas, historico }`; o subagente recebe `{ campanhaId, pergunta, historico }`. O cliente pode enriquecer a pergunta com trechos RAG antes de enviá-la.

Cada elemento de `historico` contém `pergunta`, `resposta`, `materia` e `status`. São selecionadas até cinco trocas recentes `RESPONDIDO` ou `ESCLARECIMENTO`, sem texto suprimido e ainda válidas. O limite atual de 8.000 caracteres soma os textos; o orçamento da serialização completa ainda precisa ser fechado.

A pergunta atual é enviada separadamente. O histórico ajuda a interpretar referências, não substitui fontes didáticas nem instruções de sistema. Formatos de esclarecimento e resposta: [schema dos agentes](../../watsonx/agent-educational/schema.json).

## Persistência e ciclo de vida

1. O handler reserva a pergunta antes de chamar os agentes.
2. Recupera o histórico e processa a pergunta.
3. Confirma o resultado no banco antes da resposta pedagógica em voz.
4. Emite um token para a próxima captura.

Retries de turnos concluídos reutilizam a mensagem salva. Reservas ainda em processamento não iniciam outra execução com o mesmo token; leases vencidos podem ser retomados. A validação do proprietário na conclusão e a exclusão mútua entre tokens diferentes ainda são pendências explícitas.

`mensagem_retorno` é o texto preparado para leitura; não comprova que o aluno ouviu o áudio.

## Retenção

`expira_em = recebida_em + 168 horas`. Novos turnos não renovam a validade dos anteriores. Contexto e analytics filtram registros vencidos; o replay de tokens ainda precisa da mesma verificação por interação.

A rotina em `backend/src/jobs/expurgo.js` encerra conversas por inatividade configurada e exclui registros vencidos. Hoje é acionada na inicialização da API e a cada minuto dentro do processo web. Retenção em backups, agendamento independente e coordenação distribuída ainda precisam ser aplicados.

Encerrar a chamada limpa o estado local de tentativas e mantém os registros até seu vencimento. O callback pode recuperar a conversa pela chave HMAC após reinício do handler.

## Verificação

- Testes de serviço: `backend/tests/conversas.test.js`.
- Testes de rotas: `backend/tests/http-contracts.test.js`.
- Testes de voz: `backend/telephony-handler/tests/voice.test.js`.
- Integração com PostgreSQL local: `backend/scripts/check-integration.mjs`.
