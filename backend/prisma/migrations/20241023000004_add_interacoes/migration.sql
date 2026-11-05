-- Migration: add_interacoes
-- Tabela de interações de voz — histórico anônimo por campanha.
-- Sem FK para campanhas: o histórico sobrevive à deleção da campanha.
-- Registros são imutáveis (sem updated_at).

CREATE TABLE "interacoes" (
  "id"                    TEXT NOT NULL,
  "campanha_id"           TEXT NOT NULL,
  "pergunta"              TEXT NOT NULL,
  "resposta"              TEXT,
  "score_confianca_stt"   DOUBLE PRECISION,
  "score_confianca_agente" DOUBLE PRECISION,
  "sem_resposta"          BOOLEAN NOT NULL DEFAULT false,
  "call_sid"              TEXT NOT NULL,
  "criado_em"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "interacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interacoes_campanha_id_idx" ON "interacoes"("campanha_id");
CREATE INDEX "interacoes_criado_em_idx" ON "interacoes"("criado_em");
