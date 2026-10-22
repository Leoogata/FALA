# backend/telephony-handler — Handler de Voz (STT → Agente → TTS)

**Responsável pela US-08-handler.**

Webhook que recebe o áudio de cada turno de uma chamada, transcreve com STT, chama o agente educacional no watsonx com o índice da campanha e devolve a resposta em áudio via TTS. É o único componente que orquestra todo o ciclo de voz.

## O que faz

- Expõe webhook consumido pelo provedor de telefonia (Twilio/etc.)
- Transcreve o áudio do aluno via STT
- Chama o agente educacional (`watsonx/agent-educational`) com `{ pergunta, campanha_id }`
- Converte a resposta em áudio via TTS e devolve ao provedor
- Trata `sem_resposta: true` com áudio de fallback orientando buscar o professor
- Dispara `POST /interacoes` ao final de cada turno (US-09)

## O que precisa estar aqui

- Handler HTTP do webhook de voz
- Cliente STT (watsonx Speech, Deepgram, Google STT — a definir)
- Cliente para o agente educacional no watsonx
- Cliente TTS
- Áudios de fallback pré-gravados (ou geração dinâmica)
- Lógica de disparo do registro no serviço de analytics
- Testes do ciclo completo com áudios de exemplo

## O que NÃO deve estar aqui

- Configuração da URA ou do número de telefone (isso é `telephony`)
- Prompt ou system message do agente (isso é `watsonx/agent-educational`)
- Lógica de RAG (isso é `backend/rag-pipeline`)
- Persistência direta no banco (chamar a API de analytics)

## Como fala com os outros módulos

- **telephony** encaminha chamadas para este webhook após a URA
- **watsonx/agent-educational** é consumido via API para gerar respostas
- **backend/analytics** recebe `POST /interacoes` ao final de cada turno

## Risco principal

Latência total do ciclo STT + inferência + TTS. Precisa ficar aceitável para uma conversa por telefone (ideal < 2s por turno).

## Setup

A ser preenchido quando os provedores STT/TTS forem escolhidos.
