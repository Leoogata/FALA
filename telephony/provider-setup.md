# telephony/provider-setup.md — Configuração do Twilio

## Visão geral

Este documento descreve o passo a passo para provisionar o número Twilio e apontar os webhooks para o `backend/telephony-handler`. O Twilio é responsável apenas pelo transporte de voz e pelo reconhecimento de fala (STT nativo via `<Gather input="speech">`); toda a lógica de negócio permanece no handler.

---

## 1. Criar conta Twilio

1. Acesse [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio) e registre-se.
2. Após confirmar o e-mail, acesse o **Console** em `https://console.twilio.com`.
3. Anote os valores na seção **Account Info**:
   - `TWILIO_ACCOUNT_SID` — começa com `AC…`
   - `TWILIO_AUTH_TOKEN` — chave secreta, nunca versionar

> **Conta trial:** limita o uso a números verificados, adiciona uma locução de aviso no início de cada chamada e possui cota de minutos. Use apenas para validação técnica. Para atender alunos reais, converta a conta para paga.

---

## 2. Provisionar número de telefone

1. No Console, acesse **Phone Numbers → Manage → Buy a number**.
2. Selecione país **Brazil (+55)** e tipo **Voice**.
3. Escolha um número local (DDD da região do projeto) para reduzir custo de plataforma.
   - O número 0800 envolve operadora parceira, documentação e prazo — é uma meta pós-MVP.
4. Clique em **Buy** e confirme.
5. Anote o número adquirido em `TWILIO_PHONE_NUMBER` (formato E.164, ex: `+5511900000000`).

---

## 3. Configurar webhooks no número

1. No Console, acesse **Phone Numbers → Manage → Active numbers** e clique no número.
2. Na seção **Voice & Fax → A CALL COMES IN**, configure:
   - Tipo: **Webhook**
   - URL: `https://<seu-domínio>/voice/incoming`
   - Método: **HTTP POST**
3. Salve.

> O handler valida a assinatura Twilio em todas as rotas. Certifique-se de que a URL pública usada na configuração do número é exatamente igual à usada na validação (`X-Twilio-Signature`), incluindo protocolo e path.

---

## 4. Expor o handler publicamente (desenvolvimento local)

Para testes locais, use **ngrok** ou equivalente:

```bash
ngrok http 3000
# Copie a URL HTTPS gerada (ex: https://xxxx.ngrok.io) e use-a no passo 3
```

Em produção, use HTTPS com certificado válido (o Twilio rejeita HTTP em produção).

---

## 5. Variáveis de ambiente

Adicione ao `.env` do `backend/telephony-handler`:

```env
# Twilio
TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+5511900000000

# Backend API e controles de voz
BACKEND_API_URL=https://<url-do-backend-api>
TWILIO_STT_CONFIDENCE_THRESHOLD=0.6
VOICE_MAX_RETRIES=2

# watsonx Agent Educacional
WATSONX_AGENT_EDUCATIONAL_ID=
WATSONX_API_KEY=
WATSONX_PROJECT_ID=
ORCHESTRATOR_CONFIDENCE_THRESHOLD=0.5

# Backend Analytics (US-09)
ANALYTICS_SERVICE_URL=https://<url-do-analytics>
```

---

## 6. SIDs e IDs necessários

| Variável | Onde encontrar |
|----------|---------------|
| `TWILIO_ACCOUNT_SID` | Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Console → Account Info |
| `TWILIO_PHONE_NUMBER` | Console → Phone Numbers → Active numbers |

---

## 7. Limitações do trial

| Limitação | Detalhe |
|-----------|---------|
| Locução automática | Toda chamada inicia com aviso "This call was made from a Twilio trial account" |
| Números destino | Só pode receber chamadas de números verificados em **Verified Caller IDs** |
| Cota de minutos | Limitada; verifique no Console em **Billing → Overview** |
| Uso público | **Não adequado** para alunos reais — requer conta paga |

---

## 8. Próximos passos após validação técnica

- Converter conta trial para paga (Upgrade na página de billing do Console).
- Avaliar contratação de número 0800 via operadora parceira Twilio Brasil para isentar o aluno do custo da ligação.
- Configurar alertas de custo no Console (**Billing → Alerts**).
