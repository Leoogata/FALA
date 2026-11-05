-- Estende a tabela criada em 20241023000004; não cria outra tabela interacoes.
-- Preserva IDs/textos antigos e substitui call_sid por associação aleatória.
BEGIN;

CREATE TYPE "ConversaEstado" AS ENUM ('ATIVA', 'ENCERRADA', 'EXPIRADA');
CREATE TYPE "InteracaoStatus" AS ENUM ('RECEBIDO', 'RESPONDIDO', 'ESCLARECIMENTO', 'SEM_ROTA', 'SEM_RESPOSTA', 'ERRO');
CREATE TYPE "Materia" AS ENUM ('historia', 'geografia', 'portugues', 'matematica', 'ciencias');

CREATE TABLE "conversas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chave_chamada" TEXT NOT NULL,
    "versao_chave" TEXT NOT NULL,
    "estado" "ConversaEstado" NOT NULL DEFAULT 'ATIVA',
    "criada_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atividade_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em" TIMESTAMPTZ,
    "expira_em" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "interacoes"
    ALTER COLUMN "campanha_id" DROP NOT NULL,
    ALTER COLUMN "pergunta" DROP NOT NULL,
    ADD COLUMN "conversa_id" UUID,
    ADD COLUMN "turno_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN "ordem" INTEGER,
    ADD COLUMN "materia" "Materia",
    ADD COLUMN "mensagem_retorno" VARCHAR(1000),
    ADD COLUMN "status" "InteracaoStatus" NOT NULL DEFAULT 'RECEBIDO',
    ADD COLUMN "texto_suprimido" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "score_confianca_orquestrador" DOUBLE PRECISION,
    ADD COLUMN "duracao_ms" INTEGER,
    ADD COLUMN "versao_prompt" TEXT,
    ADD COLUMN "execucao_id" UUID,
    ADD COLUMN "lease_expira_em" TIMESTAMPTZ,
    ADD COLUMN "recebida_em" TIMESTAMPTZ,
    ADD COLUMN "concluida_em" TIMESTAMPTZ,
    ADD COLUMN "expira_em" TIMESTAMPTZ;

-- Uma conversa por chamada legada; o identificador original só existe nesta
-- tabela temporária até o COMMIT e é removido da tabela permanente abaixo.
CREATE TEMP TABLE "_conversas_legadas" ON COMMIT DROP AS
SELECT "call_sid", gen_random_uuid() AS "id"
FROM (SELECT DISTINCT "call_sid" FROM "interacoes") AS chamadas;

INSERT INTO "conversas" (
    "id", "chave_chamada", "versao_chave", "estado", "criada_em",
    "ultima_atividade_em", "encerrada_em", "expira_em"
)
SELECT mapa."id", 'legacy:' || mapa."id"::text, 'legacy-migration', 'ENCERRADA',
       MIN(i."criado_em") AT TIME ZONE 'UTC',
       MAX(i."criado_em") AT TIME ZONE 'UTC',
       MAX(i."criado_em") AT TIME ZONE 'UTC',
       (MAX(i."criado_em") AT TIME ZONE 'UTC') + INTERVAL '168 hours'
FROM "_conversas_legadas" mapa
JOIN "interacoes" i ON i."call_sid" = mapa."call_sid"
GROUP BY mapa."id";

UPDATE "interacoes" i SET
    "conversa_id" = mapa."id",
    "recebida_em" = i."criado_em" AT TIME ZONE 'UTC',
    "concluida_em" = i."criado_em" AT TIME ZONE 'UTC',
    "expira_em" = (i."criado_em" AT TIME ZONE 'UTC') + INTERVAL '168 hours',
    "status" = CASE WHEN NOT i."sem_resposta" AND NULLIF(TRIM(i."resposta"), '') IS NOT NULL
                    THEN 'RESPONDIDO'::"InteracaoStatus"
                    ELSE 'SEM_RESPOSTA'::"InteracaoStatus" END,
    "sem_resposta" = i."sem_resposta" OR NULLIF(TRIM(i."resposta"), '') IS NULL,
    "mensagem_retorno" = LEFT(COALESCE(i."resposta", ''), 1000),
    "materia" = CASE WHEN i."campanha_id" IN ('historia', 'geografia', 'portugues', 'matematica', 'ciencias')
                     THEN i."campanha_id"::"Materia" ELSE NULL END
FROM "_conversas_legadas" mapa WHERE i."call_sid" = mapa."call_sid";

WITH ordenadas AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "conversa_id" ORDER BY "recebida_em", "id")::integer AS ordem
    FROM "interacoes"
)
UPDATE "interacoes" i SET "ordem" = ordenadas.ordem FROM ordenadas WHERE i."id" = ordenadas."id";

-- O contrato anterior armazenava slug; o histórico novo usa a FK real e
-- conserva a matéria separadamente, inclusive se a campanha não existir mais.
UPDATE "interacoes" i SET "campanha_id" = (
    SELECT c."id" FROM "campanhas" c
    WHERE c."id" = i."campanha_id" OR c."slug" = i."campanha_id"
    LIMIT 1
);

ALTER TABLE "interacoes"
    ALTER COLUMN "conversa_id" SET NOT NULL,
    ALTER COLUMN "turno_token" DROP DEFAULT,
    ALTER COLUMN "ordem" SET NOT NULL,
    ALTER COLUMN "recebida_em" SET NOT NULL,
    ALTER COLUMN "recebida_em" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "expira_em" SET NOT NULL,
    DROP COLUMN "call_sid",
    DROP COLUMN "criado_em";

CREATE UNIQUE INDEX "conversas_chave_chamada_key" ON "conversas"("chave_chamada");
CREATE INDEX "conversas_expira_em_idx" ON "conversas"("expira_em");
CREATE UNIQUE INDEX "interacoes_turno_token_key" ON "interacoes"("turno_token");
CREATE UNIQUE INDEX "interacoes_conversa_id_ordem_key" ON "interacoes"("conversa_id", "ordem");
CREATE INDEX "interacoes_conversa_id_recebida_em_idx" ON "interacoes"("conversa_id", "recebida_em");
CREATE INDEX "interacoes_expira_em_idx" ON "interacoes"("expira_em");
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_conversa_id_fkey"
    FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_campanha_id_fkey"
    FOREIGN KEY ("campanha_id") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
