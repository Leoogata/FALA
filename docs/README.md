# docs — Documentação do Projeto Ponte

Documentação viva do projeto. Tudo que é decisão, plano, arquitetura ou contrato entre componentes vive aqui.

## O que precisa estar aqui

- `user-stories.md` — user stories completas (12 USs em 5 épicos), com goals, escopo e critérios de aceite
- `sprint-plan.md` — plano de 3 semanas para 3 pessoas, com agrupamento de USs por semana e por pessoa
- `architecture.md` — visão de arquitetura, diagrama de componentes e fluxos principais
- `contracts/` — contratos entre componentes:
  - `api-campanhas.md` — endpoints e schemas da API de campanhas
  - `agent-educational.md` — contrato de input/output do agente educacional
  - `agent-score.md` — contrato de input/output do agente de score (stretch)
  - `interacao.md` — schema do registro de interação anônima
- `decisions/` — ADRs (Architecture Decision Records) de decisões tomadas:
  - escolha do provedor de telefonia
  - escolha de STT e TTS
  - framework de frontend
  - stack de backend
- `demo-script.md` — roteiro da demonstração para a competição
- `video-script.md` — roteiro do vídeo de 3 minutos

## O que NÃO deve estar aqui

- Código executável — só documentação
- Credenciais ou segredos — nunca
- Documentação específica de um módulo que já tem seu próprio README (deixar lá, não duplicar aqui)

## Restrições da competição IBM

- Sem dados pessoais nem de clientes
- Dados públicos apenas com uso comercial permitido
- Documentação clara do projeto e vídeo de 3 minutos no YouTube são entregas obrigatórias
