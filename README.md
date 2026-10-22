# FALA — Projeto Ponte

Repositório da eletiva IBM com Bob · Grupo FALA · Trilha 3 (Fundação Telefônica)

**Ponte** é uma plataforma que leva ensino a estudantes de regiões sensíveis via chamada telefônica. O aluno liga, escolhe uma campanha, faz uma pergunta de voz, e um agente de IA com RAG responde em áudio — tudo sem precisar de internet no lado do aluno.

## Arquitetura em uma frase

Telefonia (URA + webhook) → STT → Agente educacional no watsonx com RAG por campanha → TTS → de volta ao aluno. Histórico anônimo é persistido para análise.

## Estrutura do repositório

```
backend/
  api/                   → API CRUD de campanhas e documentos (US-04)
  rag-pipeline/          → Pipeline de chunking/embedding/indexação no watsonx (US-05)
  telephony-handler/     → Webhook STT → agente → TTS (US-08-handler)
  analytics/             → Endpoints de agregação do histórico (US-09, US-10)

frontend/
  campaigns/             → Tela de gestão de campanhas (US-06)
  analytics/             → Tela de métricas por campanha (US-10)
  dashboard/             → Mapa de regiões (US-03-front, stretch)

watsonx/
  agent-educational/     → Configuração do agente educacional (US-08-agent)
  agent-score/           → Configuração do agente de score de regiões (US-02, stretch)

telephony/               → Configuração do provedor (Twilio/etc.) e URA (US-07)
data-pipeline/           → Scripts de coleta e normalização de datasets públicos (US-01, stretch)
docs/                    → User stories, plano de 3 semanas, documentação técnica
design/                  → Artefatos de design (Figma, cartões, protótipos)
```

## Documentos principais

- `docs/user-stories.md` — User stories completas, agrupadas em 5 épicos
- `docs/sprint-plan.md` — Plano de 3 semanas para 3 pessoas
- `docs/architecture.md` — Visão de arquitetura e fluxos
- `docs/decisions/` — Decisões técnicas registradas (ADRs)

## Setup

Cada subpasta tem seu próprio README com dependências e instruções de setup específicas.
