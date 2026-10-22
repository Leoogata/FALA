# frontend/analytics — Tela de Métricas por Campanha

**Responsável pela parte frontend da US-10.**

Tela que exibe as métricas de uso do agente por campanha. Consome os endpoints de agregação em `backend/analytics`.

## O que faz

- Exibe lista de campanhas e permite escolher uma
- Mostra, para a campanha selecionada:
  - Top perguntas feitas
  - Percentual de respostas com `sem_resposta: true`
  - Volume de chamadas por dia (gráfico simples)

## O que precisa estar aqui

- Página da tela de métricas
- Componente de lista de top perguntas
- Componente de gráfico de volume (Chart.js, Recharts, etc.)
- Chamadas à API do `backend/analytics`
- Design consistente com `frontend/campaigns`

## O que NÃO deve estar aqui

- Nenhum dado individual — a tela mostra apenas dados agregados
- Lógica de agregação (isso é `backend/analytics`)
- Dados de regiões/municípios (isso é `frontend/dashboard`, stretch)

## Como fala com os outros módulos

- Consome **backend/analytics** via `GET /analytics/campanhas/:id`

## Setup

A ser preenchido junto com `frontend/campaigns` (mesma stack).
