# backend — Serviços de Backend

Agrupa os serviços de backend do Ponte, divididos por responsabilidade.

## Subpastas

- `api/` — API CRUD de campanhas e documentos (US-04)
- `rag-pipeline/` — Pipeline de indexação RAG no watsonx (US-05)
- `telephony-handler/` — Webhook de voz: STT → agente → TTS (US-08-handler)
- `analytics/` — Persistência de interações e endpoints de métricas (US-09, US-10)

## Separação por serviço vs. monorepo lógico

Cada subpasta tem a sua responsabilidade bem definida. Fica a critério do time se vão rodar como processos separados ou como um único serviço com rotas internas. Para o MVP, provavelmente um único processo com módulos separados é mais simples.

## Decisões técnicas em aberto

- Stack: Node/Express? Python/FastAPI? Java/Spring?
- Banco de dados: Postgres? MongoDB?
- Storage de documentos: filesystem local, S3, bucket do watsonx?

Essas decisões afetam todas as subpastas — definir cedo.
