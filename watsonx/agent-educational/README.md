# Agente educacional único

Um único deployment watsonx atende o agente padrão e as configurações escolares. A seleção é determinística pelo código da escola. RAG é executado no backend, com embeddings IBM e armazenamento PostgreSQL/pgvector.

Contrato e configuração: [README-config.md](README-config.md).

Os cenários antigos em `test-cases/` documentam o fluxo anterior por matéria. Os testes executáveis da arquitetura atual estão em `backend/tests/educational.test.js`, `agent-config.test.js`, `school-isolation.test.js`, `vector-client.test.js` e no serviço de telefonia.
