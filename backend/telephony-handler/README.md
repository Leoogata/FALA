# backend/telephony-handler — Handler de Voz (Twilio → watsonx → TwiML)

**Responsável pela US-08-handler.**

Webhooks Express que fecham o ciclo de voz: recebem o texto reconhecido pelo Twilio (`<Gather input="speech">`), invocam o agente orquestrador para identificar a matéria, chamam o subagente educacional correspondente e devolvem TwiML com a resposta falada via `<Say>`. Ao final de cada turno, registra a interação no serviço de analytics (US-09).

---

## Estrutura

```
backend/telephony-handler/
├── src/
│   ├── index.js                  # Entrypoint (listen)
│   ├── app.js                    # Configuração Express + rotas
│   ├── config.js                 # Variáveis de ambiente e defaults
│   ├── routes/
│   │   └── voice.js              # POST /voice/incoming e POST /voice/turn
│   ├── handlers/
│   │   ├── incomingHandler.js    # Lógica de /voice/incoming
│   │   └── turnHandler.js        # Lógica de /voice/turn (ciclo principal)
│   └── services/
│       ├── twilioValidation.js   # Middleware de validação de assinatura Twilio
│       ├── twiml.js              # Construtores de TwiML reutilizáveis
│       ├── orchestrator.js       # Cliente do agente orquestrador watsonx
│       ├── agentEducational.js   # Cliente dos subagentes educacionais watsonx
│       ├── campanhas.js          # GET /campanhas (backend/api)
│       ├── analytics.js          # POST /interacoes (backend/analytics, fire-and-forget)
│       └── callSession.js        # Controle de tentativas por chamada (in-memory)
└── tests/
    └── voice.test.js             # Testes Jest + Supertest
```

---

## Endpoints

### `POST /voice/incoming`

Chamado pelo Twilio ao receber uma ligação.

**Payload:** form-encoded (ver `telephony/webhook-contract.md`)

**Resposta:** TwiML com `<Say>` de boas-vindas e `<Gather input="speech">` cujo `action` aponta para `/voice/turn`.

---

### `POST /voice/turn`

Chamado pelo Twilio ao concluir o `<Gather>` (com ou sem fala).

**Payload:** form-encoded com `SpeechResult`, `Confidence`, `CallSid` (ver `telephony/webhook-contract.md`)

**Resposta:** TwiML de acordo com o resultado do processamento:

| Situação | TwiML devolvido |
|----------|----------------|
| Fala válida + rota + resposta | `<Say>` resposta + `<Gather>` próximo turno |
| Fala válida + rota + `sem_resposta: true` | `<Say>` fallback professor + `<Gather>` próximo turno |
| Fala válida + `sem_rota: true` | `<Say>` pede reformulação + `<Gather>` |
| Ausência/baixa confiança (< MAX_RETRIES) | `<Say>` pede repetição + `<Gather>` |
| Ausência/baixa confiança (>= MAX_RETRIES) | `<Say>` encerramento + `<Hangup>` |
| Aluno pressiona tecla | `<Say>` encerramento + `<Hangup>` |

---

## Validação de assinatura Twilio

Todas as rotas passam pelo middleware `validateTwilioSignature`. A URL usada na validação deve ser exatamente igual à URL configurada no painel Twilio (incluindo protocolo, host e path).

Em `NODE_ENV=test`, a validação é desabilitada para facilitar testes unitários.

---

## Variáveis de ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta do servidor | `3000` |
| `TWILIO_ACCOUNT_SID` | SID da conta Twilio | — |
| `TWILIO_AUTH_TOKEN` | Auth token Twilio | — |
| `TWILIO_PHONE_NUMBER` | Número Twilio em E.164 | — |
| `TWILIO_STT_CONFIDENCE_THRESHOLD` | Confiança mínima de transcrição | `0.6` |
| `VOICE_MAX_RETRIES` | Tentativas STT antes de encerrar | `2` |
| `BACKEND_API_URL` | URL do backend/api (GET /campanhas) | — |
| `ANALYTICS_SERVICE_URL` | URL do backend/analytics (POST /interacoes) | — |
| `WATSONX_API_KEY` | Chave de API IBM Cloud | — |
| `WATSONX_PROJECT_ID` | ID do projeto watsonx | — |
| `WATSONX_AGENT_ORCHESTRATOR_ID` | ID da implantação ou serving name do orquestrador | — |
| `WATSONX_AGENT_ID_HISTORIA` | ID da implantação ou serving name do subagente de História | — |
| `WATSONX_AGENT_ID_GEOGRAFIA` | ID da implantação ou serving name do subagente de Geografia | — |
| `WATSONX_AGENT_ID_PORTUGUES` | ID da implantação ou serving name do subagente de Português | — |
| `WATSONX_AGENT_ID_MATEMATICA` | ID da implantação ou serving name do subagente de Matemática | — |
| `WATSONX_AGENT_ID_CIENCIAS` | ID da implantação ou serving name do subagente de Ciências | — |
| `ORCHESTRATOR_CONFIDENCE_THRESHOLD` | Confiança mínima do orquestrador | `0.5` |

Mensagens de voz também são configuráveis via variáveis de ambiente (ver `src/config.js`).

---

## Execução local

```bash
# instalar dependências
npm install

# rodar em desenvolvimento (hot reload)
npm run dev

# rodar em produção
npm start
```

Expor publicamente para testes com Twilio (requer ngrok ou equivalente):

```bash
ngrok http 3000
# Use a URL HTTPS gerada como webhook no painel Twilio
```

---

## Testes

```bash
npm test
```

Casos cobertos:
- `POST /voice/incoming` — retorna TwiML de boas-vindas
- Ausência de fala — pede repetição / encerra após limite
- Baixa confiança STT — pede repetição
- Encerramento por tecla
- Roteamento para cada uma das 5 matérias
- Pergunta ambígua / fora do escopo (`sem_rota: true`)
- Caminho feliz — resposta disponível + registro no analytics
- Fallback `sem_resposta: true` — áudio de fallback + registro no analytics

---

## O que NÃO está aqui

- Configuração do número Twilio → `telephony/provider-setup.md`
- Prompts e system messages dos agentes → `watsonx/agent-educational/system-prompt.md`
- Lógica RAG → `backend/rag-pipeline`
- Persistência direta no banco — o handler chama a API de analytics
- Gravação ou armazenamento de áudio — não há no fluxo MVP
