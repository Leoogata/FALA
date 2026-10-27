-- Migration: add_descricao_to_campanhas
-- Adiciona o campo descricao (system prompt do agente) à tabela campanhas.
-- Nullable — campanhas sem descricao usam o prompt padrão do agente educacional.

ALTER TABLE "campanhas" ADD COLUMN "descricao" TEXT;
