-- Migração: memória de conversa (US-08/US-09)
-- Adiciona enums e modelos Conversa e Interacao com controle de concorrência por lease.

-- CreateEnum
CREATE TYPE "ConversaEstado" AS ENUM ('ATIVA', 'ENCERRADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "InteracaoStatus" AS ENUM ('RECEBIDO', 'RESPONDIDO', 'ESCLARECIMENTO', 'SEM_ROTA', 'SEM_RESPOSTA', 'ERRO');

-- CreateEnum
CREATE TYPE "Materia" AS ENUM ('historia', 'geografia', 'portugues', 'matematica', 'ciencias');

-- CreateTable
CREATE TABLE "conversas" (
    "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    "chave_chamada"       TEXT        NOT NULL,
    "versao_chave"        TEXT        NOT NULL,
    "estado"              "ConversaEstado" NOT NULL DEFAULT 'ATIVA',
    "criada_em"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atividade_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em"        TIMESTAMPTZ,
    "expira_em"           TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes" (
    "id"                           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "conversa_id"                  UUID        NOT NULL,
    "turno_token"                  UUID        NOT NULL,
    "ordem"                        INTEGER     NOT NULL,
    "campanha_id"                  TEXT,
    "materia"                      "Materia",
    "pergunta"                     VARCHAR(500),
    "resposta"                     VARCHAR(1000),
    "mensagem_retorno"             VARCHAR(1000),
    "status"                       "InteracaoStatus" NOT NULL DEFAULT 'RECEBIDO',
    "texto_suprimido"              BOOLEAN     NOT NULL DEFAULT false,
    "sem_resposta"                 BOOLEAN     NOT NULL DEFAULT false,
    "score_confianca_stt"          DECIMAL(4,3),
    "score_confianca_orquestrador" DECIMAL(4,3),
    "score_confianca_agente"       DECIMAL(4,3),
    "duracao_ms"                   INTEGER,
    "versao_prompt"                TEXT,
    "execucao_id"                  UUID,
    "lease_expira_em"              TIMESTAMPTZ,
    "recebida_em"                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em"                 TIMESTAMPTZ,
    "expira_em"                    TIMESTAMPTZ NOT NULL,

    CONSTRAINT "interacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversas_chave_chamada_key" ON "conversas"("chave_chamada");
CREATE INDEX "conversas_expira_em_idx"         ON "conversas"("expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "interacoes_turno_token_key"         ON "interacoes"("turno_token");
CREATE UNIQUE INDEX "interacoes_conversa_id_ordem_key"   ON "interacoes"("conversa_id", "ordem");
CREATE INDEX        "interacoes_conversa_id_recebida_idx" ON "interacoes"("conversa_id", "recebida_em");
CREATE INDEX        "interacoes_expira_em_idx"            ON "interacoes"("expira_em");

-- AddForeignKey
ALTER TABLE "interacoes"
    ADD CONSTRAINT "interacoes_conversa_id_fkey"
    FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interacoes"
    ADD CONSTRAINT "interacoes_campanha_id_fkey"
    FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
