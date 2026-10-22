# frontend/dashboard — Mapa de Regiões Sensíveis *(stretch)*

**Responsável pela US-03-front — faz parte do Épico 1 (stretch).**

Tela com um mapa interativo exibindo os municípios coloridos por nível de sensibilidade. Consome a API em `backend/analytics` ou um endpoint específico de `data-pipeline`.

## Status: stretch

Esta tela só deve ser atacada se o MVP (Épicos 2–5) estiver estável. Não começar antes do fluxo de voz funcionar na demo.

## O que faz

- Renderiza mapa interativo do Brasil (ou região escolhida) com municípios
- Colore municípios por nível de sensibilidade (alta/média/baixa)
- Filtros: por UF, por faixa de score, por cobertura de rede
- Painel lateral: ao clicar num município, mostra os 3 fatores que geraram o score

## O que precisa estar aqui

- Página do mapa
- Biblioteca de mapas (Leaflet, Mapbox, D3-geo — a escolher)
- Lógica de filtros
- Painel lateral de detalhes
- Chamadas ao endpoint `GET /municipios`

## O que NÃO deve estar aqui

- Lógica de score (isso é `watsonx/agent-score`)
- Processamento de dados (isso é `data-pipeline` + `watsonx/agent-score`)

## Como fala com os outros módulos

- Consome o endpoint `GET /municipios` servido pelo job de batch do score (ver `data-pipeline/README.md`)

## Setup

A ser preenchido se a feature stretch entrar no escopo.
