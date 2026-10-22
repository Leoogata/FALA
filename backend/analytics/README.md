# backend/analytics — Persistência e Agregação de Interações

**Responsável pelas US-09 e US-10 (parte backend).**

Serviço que registra cada turno de ligação de forma anônima e expõe endpoints de agregação para o front consumir métricas.

## O que faz

- Recebe `POST /interacoes` do handler de voz ao final de cada turno
- Persiste a interação de forma estritamente anônima
- Agrega os dados e expõe métricas por campanha

## O que precisa estar aqui

- Modelagem do banco: tabela `interacoes` (id, campanha_id, pergunta, resposta, confianca, sem_resposta, timestamp)
- Endpoint `POST /interacoes` com validação que rejeita qualquer PI (telefone, nome, CPF)
- Endpoint `GET /analytics/campanhas/:id` retornando:
  - top perguntas por campanha
  - % de respostas com baixa confiança (`sem_resposta: true`)
  - volume de chamadas por período
- Dados sempre agregados — nenhuma query retorna registros individuais
- Testes dos endpoints e da regra de rejeição de PI

## O que NÃO deve estar aqui

- Nenhum campo de identificação pessoal nos registros
- UI (isso é `frontend/analytics`)
- Lógica de retreino de modelo

## Como fala com os outros módulos

- **backend/telephony-handler** chama `POST /interacoes` ao final de cada turno
- **frontend/analytics** consome `GET /analytics/campanhas/:id`

## Regras de privacidade

Qualquer payload que contenha telefone, nome, email ou CPF deve retornar 422. Isso é parte das restrições da competição IBM — sem dados pessoais, sem dados de clientes.

## Setup

A ser preenchido quando a stack for escolhida.
