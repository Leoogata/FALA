# telephony — Configuração do Provedor e URA

**Responsável pela US-07.**

Configuração do número de telefone, da URA (menu de voz) e do roteamento da chamada para o handler da campanha correta. Esta pasta não tem código de aplicação — é configuração + documentação do provedor escolhido.

## O que faz

- Recebe chamadas no número configurado
- URA busca campanhas ativas via `GET /campanhas` e apresenta ao aluno por voz
- Roteamento: a seleção do aluno determina qual campanha vai no handler
- Fallback: se não há campanha ativa, reproduz mensagem configurável e encerra

## O que precisa estar aqui

- `provider-setup.md` — passo a passo de configuração do provedor (Twilio ou equivalente)
- `ivr-flow.md` ou `ivr-flow.json` — definição do fluxo da URA (texto dos prompts, menus, fallbacks)
- Scripts/arquivos de configuração do fluxo no provedor (TwiML, Studio Flow, etc.)
- `webhook-contract.md` — contrato do webhook que o provedor chama no `backend/telephony-handler`
- Áudios pré-gravados do fallback e dos prompts da URA (se não forem TTS dinâmico)

## O que NÃO deve estar aqui

- STT, AI, TTS — isso tudo é `backend/telephony-handler`
- UI de configuração — o painel de admin das campanhas é `frontend/campaigns`

## Observação sobre o número

Para o MVP vamos usar um número Twilio comum (não 0800). O 0800 é uma meta de produção — contratar envolve operadora, documentação e prazo. Tecnicamente, o fluxo funciona idêntico com qualquer número.

## Como fala com os outros módulos

- Consulta **backend/api** (`GET /campanhas`) para montar o menu da URA
- Encaminha chamadas para **backend/telephony-handler** após a seleção da campanha

## Decisões em aberto

- Provedor: Twilio? Vonage? watsonx Phone?
- STT/TTS: feitos no provedor ou no handler? (afeta latência)
