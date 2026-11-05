# watsonx/agent-educational/test-cases/README.md

Casos de teste para validação do roteamento do orquestrador e do comportamento dos subagentes educacionais.

## Estrutura

Cada arquivo `.json` representa um caso de teste com:
- `pergunta` — entrada do aluno
- `campanhasAtivas` — lista enviada ao orquestrador
- `roteamento_esperado` — saída esperada do `orchestrator.routeQuestion`
- `subagente_esperado` — saída esperada do `agentEducational.answerQuestion` (quando aplicável)

## Como executar

Os casos de teste são executados manualmente no watsonx Studio durante a fase de validação de roteamento. Quando a integração do handler estiver pronta (ST-3), podem ser usados como fixtures nos testes automatizados.

## Casos incluídos

| Arquivo | Tipo | Campanha esperada |
|---------|------|------------------|
| `01-historia-dom-pedro.json` | Dentro do escopo | `historia` |
| `02-geografia-capital-brasil.json` | Dentro do escopo | `geografia` |
| `03-portugues-sujeito.json` | Dentro do escopo | `portugues` |
| `04-matematica-fracao.json` | Dentro do escopo | `matematica` |
| `05-ciencias-fotossintese.json` | Dentro do escopo | `ciencias` |
| `06-ambigua-sem-rota.json` | Fora do escopo | ID de campanha ativa / `sem_rota: true` |
| `07-culinaria-sem-rota.json` | Fora do escopo | ID de campanha ativa / `sem_rota: true` |
| `08-sem-resposta-historia.json` | Sem material indexado | `historia` / `sem_resposta: true` |
