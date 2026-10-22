# watsonx/agent-educational — Agente Educacional

**Responsável pela US-08-agent.**

Configuração do agente que responde às dúvidas dos alunos durante a ligação. Usa RAG apontando para o índice da campanha ativa.

## O que faz

- Recebe `{ pergunta, campanha_id }` do handler de voz
- Faz retrieval no índice RAG da campanha (indexado por `backend/rag-pipeline`)
- Gera resposta usando o conteúdo recuperado
- Retorna `{ resposta, confianca, sem_resposta }` — se não há conteúdo adequado, retorna `sem_resposta: true` em vez de alucinar

## O que precisa estar aqui

- `system-prompt.md` — system prompt do agente (linguagem acessível para EF/EM)
- `schema.json` — schema de input/output (contrato que o handler consome)
- `test-cases/` — exemplos de perguntas (dentro e fora do escopo) para testar comportamento
- `README-config.md` — passo a passo de como configurar o agente no watsonx studio
- Documentação do comportamento de baixa confiança

## O que NÃO deve estar aqui

- Código do handler de voz (isso é `backend/telephony-handler`)
- Lógica de indexação RAG (isso é `backend/rag-pipeline`)
- Qualquer coisa relacionada a STT ou TTS

## Comportamento esperado

- Linguagem adequada para alunos de ensino fundamental e médio
- Nunca inventa resposta — se não tem contexto suficiente, retorna `sem_resposta: true`
- Respostas curtas (preferencialmente < 30s de áudio quando lidas pelo TTS)

## Como fala com os outros módulos

- Consumido pelo **backend/telephony-handler** a cada turno de ligação
- Consulta o índice RAG mantido pela **backend/rag-pipeline**

## Testes

Antes de considerar pronto, testar com perguntas:
1. Dentro do conteúdo indexado — deve responder corretamente
2. Fora do conteúdo — deve retornar `sem_resposta: true`
3. Ambígua — deve pedir mais contexto ou admitir que não sabe
