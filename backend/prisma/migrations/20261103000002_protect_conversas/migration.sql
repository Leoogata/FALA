-- Acesso às conversas é feito pela API interna, não diretamente por clientes.
BEGIN;
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
COMMIT;
