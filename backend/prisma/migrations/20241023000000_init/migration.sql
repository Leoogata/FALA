-- Migration: init
-- Cria as tabelas campanhas e documentos com enum IndexacaoStatus.
-- Nota: atualizada_em / atualizado_em são gerenciados pelo Prisma (@updatedAt),
-- não por triggers de banco.

CREATE TYPE "IndexacaoStatus" AS ENUM ('PROCESSANDO', 'PRONTO', 'ERRO');

CREATE TABLE "campanhas" (
  "id"            TEXT         NOT NULL,
  "nome"          TEXT         NOT NULL,
  "ativa"         BOOLEAN      NOT NULL DEFAULT true,
  "criada_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documentos" (
  "id"               TEXT               NOT NULL,
  "campanha_id"      TEXT               NOT NULL,
  "nome_original"    TEXT               NOT NULL,
  "mime_type"        TEXT               NOT NULL,
  "caminho_arquivo"  TEXT               NOT NULL,
  "status_indexacao" "IndexacaoStatus"  NOT NULL DEFAULT 'PROCESSANDO',
  "erro_indexacao"   TEXT,
  "criado_em"        TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"    TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documentos_campanha_id_fkey"
    FOREIGN KEY ("campanha_id")
    REFERENCES "campanhas"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "documentos_campanha_id_idx" ON "documentos"("campanha_id");
