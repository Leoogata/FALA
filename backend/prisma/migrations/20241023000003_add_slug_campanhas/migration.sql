-- Migration: add_slug_to_campanhas
-- Adiciona campo slug único e nullable ao model Campanha.
-- Nullable para preservar dados existentes — o seed preencherá as 5 campanhas fixas.
-- UNIQUE garante que dois registros não podem ter o mesmo slug (evita roteamento ambíguo).

ALTER TABLE "campanhas" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "campanhas_slug_key" ON "campanhas"("slug");
