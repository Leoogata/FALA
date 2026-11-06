-- Etapa estrutural: não altera registros nem tabelas existentes.
BEGIN;
CREATE TYPE "ConversaEstado" AS ENUM ('ATIVA', 'ENCERRADA', 'EXPIRADA');

CREATE TABLE "conversas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chave_chamada" TEXT NOT NULL,
    "versao_chave" TEXT NOT NULL,
    "estado" "ConversaEstado" NOT NULL DEFAULT 'ATIVA',
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atividade_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em" TIMESTAMPTZ,
    "expira_em" TIMESTAMPTZ NOT NULL,
    "escola_id" TEXT,
    "agente_id" TEXT,
    "instrucoes_agente" TEXT,
    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversas_chave_chamada_key" ON "conversas"("chave_chamada");
CREATE INDEX "conversas_expira_em_idx" ON "conversas"("expira_em");
COMMIT;
