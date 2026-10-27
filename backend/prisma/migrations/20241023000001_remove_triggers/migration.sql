-- Migration: remove_triggers
-- Remove triggers criados manualmente na migration inicial que conflitavam
-- com o mecanismo @updatedAt do Prisma (causavam erro "column new does not exist").

DROP TRIGGER IF EXISTS campanhas_atualizada_em ON "campanhas";
DROP TRIGGER IF EXISTS documentos_atualizado_em ON "documentos";
DROP FUNCTION IF EXISTS update_atualizada_em();
