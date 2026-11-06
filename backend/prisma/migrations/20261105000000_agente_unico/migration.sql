-- As tabelas e a extensão são criadas nas migrations estruturais 20261103000000/1.
-- O agente geral é uma configuração da plataforma, sem documentos.
BEGIN;
ALTER TABLE campanhas ADD COLUMN usa_rag BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE campanhas ALTER COLUMN ativa SET DEFAULT false;
ALTER TABLE campanhas DROP CONSTRAINT campanhas_escola_id_fkey;
ALTER TABLE campanhas ADD CONSTRAINT campanhas_escola_id_fkey
  FOREIGN KEY (escola_id) REFERENCES escolas(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- As campanhas antigas viram rascunhos. A escola escolhe qual publicar no painel.
-- Não selecionar arbitrariamente uma das antigas matérias para representar toda a escola.
UPDATE campanhas SET ativa = false WHERE escola_id IS NOT NULL;
CREATE UNIQUE INDEX campanhas_uma_ativa_por_escola
  ON campanhas(escola_id) WHERE escola_id IS NOT NULL AND ativa = true;

-- Conversas legadas podem conter materiais de escola sem identificação persistida.
-- Encerrar essas conversas impede recuperá-las como conversas do agente geral.
UPDATE conversas SET estado = 'ENCERRADA', encerrada_em = now() WHERE estado = 'ATIVA';
ALTER TABLE interacoes ADD COLUMN fontes JSONB;

-- O índice anterior podia estar apenas na memória. Reconstruir a partir dos arquivos.
UPDATE documentos d SET status_indexacao = 'PROCESSANDO', erro_indexacao = NULL
FROM campanhas a WHERE a.id = d.campanha_id AND a.escola_id IS NOT NULL
  AND d.status_indexacao = 'PRONTO';
COMMIT;
