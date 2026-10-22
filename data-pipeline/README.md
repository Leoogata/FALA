# data-pipeline — Scripts de Dados e Job de Scoring *(stretch)*

**Responsável pelas US-01 e US-03-back — faz parte do Épico 1 (stretch).**

Conjunto de scripts que coletam datasets públicos, normalizam em um formato único por município, rodam o agente de score em batch e persistem os resultados.

## Status: stretch

Toda esta pasta é parte do Épico 1 (stretch). Só mexer depois que o MVP (Épicos 2–5) estiver estável.

## O que faz

- Coleta datasets públicos (IDEB, censo escolar, cobertura de telefonia, etc.)
- Normaliza em um arquivo único com um registro por município
- Roda o job de scoring: para cada município, chama o agente em `watsonx/agent-score`
- Persiste scores no banco com código IBGE, nível, fatores, timestamp
- Expõe `GET /municipios` para o front consumir (ou junta isso na `backend/api`)

## O que precisa estar aqui

- `fontes.md` — lista de todas as fontes com URL e confirmação de uso comercial permitido
- `coleta/` — scripts de download/extração de cada fonte
- `normalizacao/` — scripts que unificam os datasets em um arquivo final
- `scoring-job/` — job que itera municípios e chama o agente de score
- `output/` — gitignored, apenas para rodadas locais; o resultado final vai para o banco
- Endpoint `GET /municipios` (pode viver aqui ou em `backend/api`)

## O que NÃO deve estar aqui

- Nenhum dado pessoal ou de clientes
- Lógica de score (isso é `watsonx/agent-score`)
- UI (isso é `frontend/dashboard`)

## Como fala com os outros módulos

- Consome o agente em **watsonx/agent-score** para calcular cada score
- Expõe `GET /municipios` consumido pelo **frontend/dashboard**

## Regras da competição aplicadas aqui

- Toda fonte precisa ter uso comercial permitido — documentar em `fontes.md`
- Nenhum dado pessoal
- Sem dados de clientes
- Sem dados de redes sociais (exceto conteúdos públicos para análise de sentimento, que não é o caso aqui)
