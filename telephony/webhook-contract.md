# telephony/webhook-contract.md — Contrato dos Webhooks Twilio

## Visão geral

O Twilio chama dois endpoints no `backend/telephony-handler` durante o ciclo de vida de uma chamada. Este documento especifica os payloads exatos enviados pelo Twilio em cada endpoint.

Todos os campos são enviados como `application/x-www-form-urlencoded` (form-encoded). O handler deve usar `express.urlencoded({ extended: false })` para parsear.

---

## Autenticação — Validação de assinatura

Toda requisição legítima do Twilio inclui o header `X-Twilio-Signature`. O handler **deve** validar essa assinatura antes de processar qualquer payload, usando o `TWILIO_AUTH_TOKEN` e a URL completa do endpoint.

```
X-Twilio-Signature: <hash HMAC-SHA1>
```

Biblioteca oficial: `twilio` (npm) — `twilio.validateRequest(authToken, signature, url, params)`.

---

## POST /voice/incoming

Chamado pelo Twilio quando o número recebe uma ligação.

### Headers

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |
| `X-Twilio-Signature` | Hash HMAC-SHA1 |

### Payload

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `CallSid` | string | ✓ | Identificador único da chamada (ex: `CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) |
| `AccountSid` | string | ✓ | SID da conta Twilio |
| `From` | string | ✓ | Número do chamador em E.164 (ex: `+5511912345678`) |
| `To` | string | ✓ | Número chamado em E.164 (ex: `+5511900000000`) |
| `CallStatus` | string | ✓ | Estado da chamada: `ringing` ou `in-progress` |
| `Direction` | string | ✓ | `inbound` |
| `ApiVersion` | string | ✓ | Versão da API Twilio (ex: `2010-04-01`) |

### Resposta esperada

TwiML com `<Gather input="speech">` conforme documentado em `ivr-flow.md`, estado "Boas-vindas".

```xml
Content-Type: text/xml

<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="auto" action="/voice/turn" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">
      Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo.
    </Say>
  </Gather>
  <Redirect method="POST">/voice/turn</Redirect>
</Response>
```

---

## POST /voice/turn

Chamado pelo Twilio quando o `<Gather>` recebe fala (ou expira sem fala). É o endpoint central do ciclo de voz.

### Headers

| Header | Valor |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |
| `X-Twilio-Signature` | Hash HMAC-SHA1 |

### Payload — presença de fala

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `CallSid` | string | ✓ | Identificador único da chamada |
| `AccountSid` | string | ✓ | SID da conta Twilio |
| `From` | string | ✓ | Número do chamador em E.164 |
| `To` | string | ✓ | Número chamado em E.164 |
| `CallStatus` | string | ✓ | `in-progress` |
| `SpeechResult` | string | ✗ | Transcrição da fala do aluno. **Ausente** se não houve fala ou se o `<Gather>` expirou sem entrada |
| `Confidence` | string (float 0–1) | ✗ | Grau de confiança da transcrição (ex: `"0.923"`). **Ausente** se `SpeechResult` estiver ausente |
| `Digits` | string | ✗ | Tecla pressionada, se `input` incluir `dtmf`. `""` se nenhuma tecla foi pressionada |
| `Language` | string | ✗ | Idioma identificado pelo STT (ex: `"pt-BR"`) |
| `ApiVersion` | string | ✓ | Versão da API Twilio |

### Payload — sem fala (timeout / Redirect)

Campos `SpeechResult`, `Confidence` e `Language` estarão **ausentes**. O handler trata isso como ausência de fala e segue o caminho de fallback STT.

### Exemplo de payload com fala

```
CallSid=CA1234567890abcdef1234567890abcdef
AccountSid=AC_ACCOUNT_SID_EXAMPLE
From=%2B5511912345678
To=%2B5511900000000
CallStatus=in-progress
SpeechResult=Quem+foi+Dom+Pedro+I%3F
Confidence=0.923
Language=pt-BR
ApiVersion=2010-04-01
```

### Exemplo de payload sem fala

```
CallSid=CA1234567890abcdef1234567890abcdef
AccountSid=AC_ACCOUNT_SID_EXAMPLE
From=%2B5511912345678
To=%2B5511900000000
CallStatus=in-progress
ApiVersion=2010-04-01
```

### Resposta esperada

TwiML de acordo com o resultado do processamento:
- Fala válida + rota + resposta: `<Say>` com a resposta + novo `<Gather>` para próximo turno
- Fallback STT: `<Say>` + `<Gather>` de repetição (ou `<Hangup>` se tentativas esgotadas)
- Fallback rota: `<Say>` pedindo reformulação + `<Gather>`
- Fallback resposta: `<Say>` orientando buscar o professor + `<Gather>`

Veja os TwiMLs completos em `ivr-flow.md`.

---

## Controle de tentativas por chamada

O handler mantém em memória (ou em cache leve) o número de tentativas de fala por `CallSid`. Quando as tentativas atingem `VOICE_MAX_RETRIES`, o handler encerra com `<Hangup>`.

> **Nota:** o estado de tentativas não precisa ser persistido em banco — a sessão de voz é curta e o `CallSid` garante unicidade por chamada.

---

## Campos de correlação em logs

Em todos os logs e no registro de interação enviado ao analytics, o `CallSid` deve aparecer como campo de correlação para facilitar debug e auditoria.
