# Serviço de voz

Aplicação Express/CommonJS separada do backend principal. Recebe webhooks Twilio, coordena os agentes watsonx, mantém o contexto da ligação pela API e devolve TwiML.

## Fluxo e endpoints

| Rota | Uso |
| --- | --- |
| `POST /voice/incoming` | Cria/recupera conversa e convida o aluno a perguntar |
| `POST /voice/turn?turno_token=...` | Valida fala, reserva turno, recupera histórico, classifica, responde e confirma persistência |
| `POST /voice/status` | Trata o término da ligação e limpa a sessão local |
| `GET /audio/:id` | Entrega áudio TTS temporário ou mensagem fixa em cache |
| `GET /health` | Verificação básica do processo |

Não há menu inicial de matérias. O orquestrador usa pergunta e histórico; o subagente recebe as trocas anteriores e o contexto RAG disponível. Até cinco trocas são recuperadas do banco.

Os webhooks de voz usam `validateTwilioSignature`; em `NODE_ENV=test`, a validação de assinatura é ignorada. O token emitido pelo handler acompanha a URL de ação de cada nova captura.

## Voz e áudio

O reconhecimento usa o texto enviado pelo `<Gather>`. A resposta usa ElevenLabs quando configurado, com fallback para `<Say>`/Polly. Mensagens fixas podem ser pré-geradas no startup.

Áudios dinâmicos ficam em memória, têm validade de cinco minutos e são consumidos na primeira leitura. Mensagens fixas ficam no cache durante a vida do processo. Isso não é gravação ou arquivo permanente da voz do aluno.

## Configuração

Copie [`.env.example`](.env.example) para `.env` e preencha os valores do ambiente.

| Grupo | Variáveis principais |
| --- | --- |
| Processo | `PORT` (padrão 3000), `PUBLIC_URL` |
| Provedor | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| Backend | `BACKEND_API_URL`, `INTERNAL_API_KEY` igual ao backend, `CONVERSA_CLIENT_TIMEOUT_MS` |
| Associação da ligação | `HMAC_SECRET`, `HMAC_SECRET_VERSION` |
| IBM | `WATSONX_API_KEY`, `WATSONX_AGENT_ORCHESTRATOR_ID` e os cinco `WATSONX_AGENT_ID_*` |
| RAG | `RAG_INTERNAL_TOKEN` igual ao backend, `RAG_TIMEOUT_MS` |
| Áudio opcional | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `TTS_TIMEOUT_MS` |
| Comportamento | Limiares de confiança, tentativas e mensagens em `src/config.js`; `VERSAO_PROMPT` para rastreabilidade |

Localmente, o backend principal normalmente fica em `http://localhost:3001`. No Compose, o endereço interno é `http://backend:3000`.

## Execução e testes

Dentro desta pasta:

```bash
npm ci
npm run dev
```

```bash
npm test
```

Os testes cobrem voz, contratos, histórico, áudio e falhas com serviços externos simulados. Uma chamada real de homologação continua necessária.

## Referências

- [Configuração do provedor](../../telephony/provider-setup.md).
- [Contrato dos webhooks](../../telephony/webhook-contract.md).
- [Memória e persistência](../../docs/contracts/conversa.md).
- [Agentes na IBM](../../watsonx/agent-educational/README-config.md).
- [Pendências de implementação e operação](../../docs/pendencias.md).
