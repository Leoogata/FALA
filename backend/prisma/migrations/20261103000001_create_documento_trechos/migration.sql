-- Etapa estrutural: não modifica agentes, documentos nem interações existentes.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
SET search_path = public, extensions;
CREATE TABLE documento_trechos (
  id BIGSERIAL PRIMARY KEY,
  documento_id TEXT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  agente_id TEXT NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  escola_id TEXT NOT NULL REFERENCES escolas(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ordem INTEGER NOT NULL,
  texto TEXT NOT NULL,
  modelo TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  UNIQUE(documento_id, ordem)
);
CREATE INDEX documento_trechos_escopo ON documento_trechos(escola_id, agente_id);
-- A API do banco não deve expor trechos para clientes anônimos/autenticados.
-- O serviço backend usa a conexão administrativa; o escopo escolar é aplicado na consulta.
ALTER TABLE documento_trechos ENABLE ROW LEVEL SECURITY;
-- Busca exata inicialmente; avaliar HNSW conforme o volume.
COMMIT;
