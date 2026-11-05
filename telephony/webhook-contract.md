# Contrato atual — Webhooks de voz

O handler recebe corpos `application/x-www-form-urlencoded` e responde TwiML (`text/xml`) nas rotas de voz. A implementação está em [routes/voice.js](../backend/telephony-handler/src/routes/voice.js).

## Assinatura

As três rotas POST de voz passam por `validateTwilioSignature`, que usa `TWILIO_AUTH_TOKEN`, `X-Twilio-Signature`, a URL pública completa e os parâmetros recebidos. Em `NODE_ENV=test`, o middleware ignora a assinatura para os testes locais.

## `POST /voice/incoming`

`CallSid` é necessário para associar a ligação. O handler calcula sua chave HMAC, cria/recupera a conversa na API e responde com boas-vindas e captura de fala. A URL de ação contém um `turno_token` gerado pelo servidor.

Falha de criação da conversa produz indisponibilidade. Requisição sem identificador de chamada é rejeitada.

## `POST /voice/turn?turno_token=<uuid>`

| Campo | Uso pelo handler |
| --- | --- |
| `CallSid` | Recuperação da conversa; obrigatório |
| `SpeechResult` | Transcrição; pode estar ausente quando não houve fala |
| `Confidence` | Confiança numérica da transcrição; comparada ao limiar configurado |
| `Digits` | Tecla de encerramento quando não há fala |
| `turno_token` | Preferencialmente na query; também aceito no body para compatibilidade |

Os demais campos enviados pelo provedor não são usados como identificação persistida do aluno. `From` não é um campo da tabela de histórico.

O token identifica uma captura. Cada próxima captura recebe outro token, mesmo se o texto for igual. Um retry de turno concluído pode reproduzir a mensagem salva. Os casos ainda incompletos de concorrência e expiração por interação estão em [pendências](../docs/pendencias.md#4-concluir-os-controles-da-memória).

| Resultado | Resposta de voz |
| --- | --- |
| Resposta pedagógica confirmada no banco | Áudio ou `<Say>` e nova captura |
| Referência ambígua | Pergunta de esclarecimento e nova captura |
| Sem rota | Solicitação de reformulação |
| Sem material validado | Fallback de ausência de resposta |
| Sem fala/baixa confiança | Repetição ou encerramento após o limite |
| Tecla sem fala | Encerramento |
| Banco indisponível | Mensagem de indisponibilidade e encerramento |

Fala válida zera somente tentativas, sem apagar o histórico. A resposta preparada é persistida antes do retorno pedagógico; isso não comprova que o aluno ouviu o áudio.

## `POST /voice/status`

Usa `CallSid` e `CallStatus`. Estados finais tratados: `completed`, `busy`, `failed`, `no-answer` e `canceled`.

Encerra a conversa e limpa a sessão local. Se a sessão foi perdida após reinício, tenta recuperá-la pela chave HMAC. A resposta do callback é HTTP 200 sem TwiML de conversa.

## Áudio e correlação

`GET /audio/:id` entrega o áudio gerado pelo serviço; não é webhook de captura. Respostas dinâmicas expiram após cinco minutos e são consumidas na leitura. Mensagens fixas podem permanecer no cache até o processo terminar.

Para correlação persistida, usar IDs internos de conversa/interação. O `CallSid` original não deve ser copiado para uma nova tabela de analytics nem para logs de conteúdo. A sanitização é heurística; os controles restantes estão no backlog.

- [Fluxo de voz](ivr-flow.md).
- [Contrato da memória](../docs/contracts/conversa.md).
