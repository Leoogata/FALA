# telephony/ivr-flow.md — Fluxo de Voz

## Visão geral

Este documento descreve o fluxo completo de uma chamada de voz do aluno, incluindo os prompts falados, as transições entre estados e os caminhos de fallback. **Não há menu inicial de matérias por teclado ou por voz** — o aluno faz a pergunta livremente e o agente orquestrador identifica a matéria.

---

## Diagrama de estados

```
[INÍCIO DA CHAMADA]
        │
        ▼
[BOAS-VINDAS + CONVITE]
  POST /voice/incoming → TwiML <Say> + <Gather input="speech">
        │
        ├─ Aluno fala → Twilio transcreve
        │       ▼
        │  [RECEBIMENTO DA PERGUNTA]
        │    POST /voice/turn
        │       │
        │       ├─ Confiança STT < threshold OU sem fala
        │       │       ▼
        │       │  [FALLBACK STT] → <Say> pede repetição
        │       │       │
        │       │       ├─ tentativas < VOICE_MAX_RETRIES → volta p/ <Gather>
        │       │       └─ tentativas >= VOICE_MAX_RETRIES → <Say> encerra
        │       │
        │       └─ Confiança STT >= threshold
        │               ▼
        │         [ROTEAMENTO ORQUESTRADOR]
        │           orchestrator.routeQuestion(...)
        │               │
        │               ├─ sem_rota: true OU confiança < threshold
        │               │       ▼
        │               │  [FALLBACK ROTA] → <Say> pede reformulação + novo <Gather>
        │               │
        │               └─ rota válida
        │                       ▼
        │                 [SUBAGENTE EDUCACIONAL]
        │                   agentEducational.answerQuestion(...)
        │                       │
        │                       ├─ sem_resposta: true
        │                       │       ▼
        │                       │  [FALLBACK RESPOSTA] → <Say> orienta buscar professor
        │                       │
        │                       └─ resposta disponível
        │                               ▼
        │                         [RESPOSTA + PRÓXIMO TURNO]
        │                           <Say> resposta + novo <Gather> ou opção de encerrar
        │
        └─ Nenhuma fala no <Gather> inicial → mesmo caminho de fallback STT
```

---

## Estados e prompts

### 1. Boas-vindas e convite (`POST /voice/incoming`)

**Ação:** o Twilio chama este endpoint ao receber uma ligação. O handler devolve TwiML com `<Say>` seguido de `<Gather>`.

**Prompt de voz:**
> "Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo."

**TwiML gerado:**
```xml
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="auto" action="/voice/turn" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">
      Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo.
    </Say>
  </Gather>
  <Redirect method="POST">/voice/turn</Redirect>
</Response>
```

> O `<Redirect>` ao final é acionado se o `<Gather>` expirar sem fala (equivale a chamar `/voice/turn` sem `SpeechResult`).

---

### 2. Recebimento da pergunta (`POST /voice/turn`)

**Ação:** o Twilio envia `SpeechResult`, `Confidence` e `CallSid`. O handler decide o próximo passo.

**Parâmetros relevantes recebidos:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `SpeechResult` | string | Transcrição da fala do aluno |
| `Confidence` | float (0–1) | Grau de confiança da transcrição |
| `CallSid` | string | Identificador único da chamada |

---

### 3. Fallback STT — ausência ou baixa confiança de fala

**Condição:** `SpeechResult` ausente, vazio, ou `Confidence < TWILIO_STT_CONFIDENCE_THRESHOLD`.

**Prompt (tentativa < VOICE_MAX_RETRIES):**
> "Não consegui entender bem. Por favor, fale sua dúvida novamente de forma clara."

**Prompt (tentativas esgotadas):**
> "Não consegui entender sua dúvida. Por favor, tente ligar novamente em um local mais silencioso. Até logo!"

**TwiML (com nova tentativa):**
```xml
<Response>
  <Gather input="speech" language="pt-BR" speechTimeout="auto" action="/voice/turn" method="POST">
    <Say language="pt-BR" voice="Polly.Camila">
      Não consegui entender bem. Por favor, fale sua dúvida novamente de forma clara.
    </Say>
  </Gather>
</Response>
```

---

### 4. Fallback de roteamento — pergunta fora das matérias ativas

**Condição:** orquestrador retorna `sem_rota: true` ou `confianca < ORCHESTRATOR_CONFIDENCE_THRESHOLD`.

**Prompt:**
> "Não identifiquei a matéria da sua dúvida. Pode reformular? Por exemplo: 'Qual é a capital do Brasil?' ou 'O que é fotossíntese?'"

---

### 5. Fallback de resposta — subagente sem material validado

**Condição:** subagente retorna `sem_resposta: true`.

**Prompt:**
> "Ainda não tenho o conteúdo dessa matéria disponível. Consulte seu professor para mais detalhes."

---

### 6. Resposta + próximo turno

**Condição:** subagente retorna `resposta` com `sem_resposta: false`.

**TwiML gerado:**
```xml
<Response>
  <Gather input="speech dtmf" language="pt-BR" speechTimeout="auto"
          action="/voice/turn" method="POST" numDigits="1">
    <Say language="pt-BR" voice="Polly.Camila">
      {resposta do subagente}
    </Say>
    <Say language="pt-BR" voice="Polly.Camila">
      Pode fazer outra pergunta ou pressione qualquer tecla para encerrar.
    </Say>
  </Gather>
  <Say language="pt-BR" voice="Polly.Camila">Até logo!</Say>
  <Hangup/>
</Response>
```

> O `input="speech dtmf"` permite que o aluno fale outra pergunta ou pressione qualquer tecla para encerrar. Se o aluno pressionar uma tecla, o `SpeechResult` estará vazio e o handler encerra a chamada.

---

## Resumo dos prompts por estado

| Estado | Prompt |
|--------|--------|
| Boas-vindas | "Olá! Sou o assistente educacional da FALA. Pode fazer sua pergunta sobre qualquer matéria escolar. Estou ouvindo." |
| Fallback STT (retry) | "Não consegui entender bem. Por favor, fale sua dúvida novamente de forma clara." |
| Fallback STT (encerrar) | "Não consegui entender sua dúvida. Por favor, tente ligar novamente em um local mais silencioso. Até logo!" |
| Fallback rota | "Não identifiquei a matéria da sua dúvida. Pode reformular? Por exemplo: 'Qual é a capital do Brasil?' ou 'O que é fotossíntese?'" |
| Fallback resposta | "Ainda não tenho o conteúdo dessa matéria disponível. Consulte seu professor para mais detalhes." |
| Próximo turno | "Pode fazer outra pergunta ou pressione qualquer tecla para encerrar." |
| Encerramento | "Até logo!" |

---

## Decisões de design

- **Sem menu inicial:** o aluno faz a pergunta livremente; a classificação por matéria é responsabilidade do agente orquestrador, não da URA.
- **Sem gravação de áudio:** o MVP não armazena o áudio do aluno. Apenas a transcrição e metadados de interação são persistidos.
- **TTS nativo Twilio:** a voz `Polly.Camila` (Amazon Polly via Twilio) oferece boa naturalidade em português brasileiro sem custo adicional de infraestrutura TTS.
- **`speechTimeout="auto"`:** deixa o Twilio decidir quando o aluno terminou de falar, reduzindo cortes prematuros.
