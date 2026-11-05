-- Migration: add_escolas
-- Introduz o conceito de Escola e torna o slug único POR escola (não mais global).

-- 1. Tabela de escolas
CREATE TABLE "escolas" (
  "id"        TEXT NOT NULL,
  "codigo"    TEXT NOT NULL,
  "nome"      TEXT NOT NULL,
  "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "escolas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "escolas_codigo_key" ON "escolas"("codigo");

-- 2. Campanha ganha escola_id (nullable — campanhas sem escola = conteúdo geral)
ALTER TABLE "campanhas" ADD COLUMN "escola_id" TEXT;

-- 3. slug deixa de ser único global e passa a ser único por escola
--    (remove o índice único antigo e cria o composto)
DROP INDEX IF EXISTS "campanhas_slug_key";
CREATE UNIQUE INDEX "campanhas_escola_id_slug_key" ON "campanhas"("escola_id", "slug");

-- 4. FK campanha -> escola, com SET NULL ao deletar a escola
ALTER TABLE "campanhas"
  ADD CONSTRAINT "campanhas_escola_id_fkey"
  FOREIGN KEY ("escola_id") REFERENCES "escolas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
