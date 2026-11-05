# Configuração de telefonia exigida pelo handler

Este guia registra os pontos que precisam estar configurados no ambiente. Confira as opções disponíveis na conta do provedor; a publicação não foi verificada nesta revisão.

## Serviços e variáveis

1. Preparar a API principal e o banco conforme o [guia do backend](../backend/README.md).
2. Configurar o [serviço de voz](../backend/telephony-handler/README.md) a partir de [`.env.example`](../backend/telephony-handler/.env.example).
3. Preencher os dados Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_PHONE_NUMBER`.
4. Conferir `BACKEND_API_URL`, `INTERNAL_API_KEY` compartilhada com a API, `HMAC_SECRET` e `HMAC_SECRET_VERSION`.
5. Preencher os IDs dos seis deployments e a chave IBM. As instruções estão no [guia dos agentes](../watsonx/agent-educational/README-config.md).
6. Para contexto de documentos, manter `RAG_INTERNAL_TOKEN` igual nos dois serviços. O cliente vetorial remoto continua pendente.

## Webhooks

Expor o handler por uma URL HTTPS acessível ao provedor e configurar:

| Evento | Destino | Método |
| --- | --- | --- |
| Entrada da chamada | `https://<dominio>/voice/incoming` | POST |
| Captura de pergunta | URL emitida no TwiML: `/voice/turn?turno_token=...` | POST |
| Término da chamada | `https://<dominio>/voice/status` | POST |

O token de captura é emitido pelo servidor; não deve ser fixado manualmente no console. A assinatura usa a URL pública completa, incluindo protocolo, host, path e query. O proxy precisa preservar os dados utilizados por `twilioValidation.js`.

## Áudio

Sem a integração ElevenLabs, o TwiML usa `<Say>`/Polly. Para habilitar áudio gerado, configurar `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` e `PUBLIC_URL`.

`PUBLIC_URL` precisa permitir acesso a `/audio/:id` no handler. O buffer de áudio dinâmico é temporário e consumido na primeira leitura; mensagens fixas são mantidas no cache do processo.

## Validação do ambiente

- Verificar `/health`, assinatura e chegada ao webhook de entrada.
- Fazer uma pergunta, continuar o assunto, mudar de matéria e responder a um pedido de esclarecimento.
- Confirmar os turnos no banco e a chegada do callback de término.
- Exercitar ausência de fala e falhas de banco, RAG e áudio.
- Medir o tempo total em ligação real.

Os detalhes dos payloads estão no [contrato](webhook-contract.md). Homologação e configuração externa continuam no [backlog](../docs/pendencias.md), sem presumir que já foram concluídas.
