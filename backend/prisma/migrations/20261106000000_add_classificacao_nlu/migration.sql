-- Adiciona campos de classificação NLU local à tabela interacoes.
-- Campos anuláveis: linhas anteriores ficam com NULL (sem classificação).
-- A coleta começa na ativação; sem reclassificação do histórico.
BEGIN;

CREATE TYPE "ClassificacaoStatus" AS ENUM ('classificada', 'indeterminada', 'erro');

ALTER TABLE "interacoes"
    ADD COLUMN "classificacao_status"  "ClassificacaoStatus",
    ADD COLUMN "materia_classificada"  "Materia",
    ADD COLUMN "classificacao_versao"  TEXT;

CREATE INDEX "interacoes_classificacao_status_idx" ON "interacoes"("classificacao_status");

COMMIT;
