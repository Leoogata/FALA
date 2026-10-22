# watsonx/agent-score — Agente de Score de Regiões *(stretch)*

**Responsável pela US-02 — faz parte do Épico 1 (stretch).**

Agente que recebe os dados de um município e retorna score de sensibilidade com justificativa. É a inteligência do dashboard de regiões.

## Status: stretch

Só configurar depois que o MVP (Épicos 2–5) estiver estável.

## O que faz

- Recebe os campos de um município (IDEB, renda per capita, % cobertura, etc.)
- Retorna `{ score: 0-100, nivel: "alta"|"média"|"baixa", fatores: string[3] }`
- Explica os 3 fatores que mais contribuíram para o score (explicabilidade)

## O que precisa estar aqui

- `system-prompt.md` — prompt estruturado com os pesos das variáveis configuráveis
- `schema.json` — schema de input/output
- `test-cases/` — municípios de exemplo com score esperado para validação manual
- `README-config.md` — passo a passo de configuração no watsonx studio

## O que NÃO deve estar aqui

- Coleta ou normalização de dados (isso é `data-pipeline`)
- Processamento em batch ou persistência (isso é `data-pipeline`)
- UI (isso é `frontend/dashboard`)

## Como fala com os outros módulos

- Consumido pelo job de batch em `data-pipeline` para calcular scores de todos os municípios
- Resultados são persistidos pelo próprio `data-pipeline` para consumo do `frontend/dashboard`

## Decisões em aberto

- Pesos das variáveis: definir junto com a análise exploratória dos dados
- Normalização dos valores de entrada: feita no agente ou no pipeline antes de chamar?
