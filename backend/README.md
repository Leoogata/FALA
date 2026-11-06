# Backend

> Atualização: arquitetura de agente único implementada. Consulte o [guia de implantação](../docs/nova-arquitetura-implantacao.md) para o fluxo, as variáveis e as migrations atuais. Menções abaixo ao orquestrador ou ao RAG simulado descrevem o fluxo anterior.

API Node.js/Express com módulos ES, Zod, PostgreSQL e Prisma. Campanhas, documentos, memória, analytics e busca RAG compartilham esse processo; a telefonia é um [serviço separado](telephony-handler/README.md).

## Organização atual

| Área | Código | Referência |
| --- | --- | --- |
| Campanhas e documentos | `src/routes`, `controllers`, `services`, `repositories` | [API](api/README.md) |
| Preparação e busca de material | `src/rag` | [Pipeline](rag-pipeline/README.md) |
| Memória e histórico | Camadas `conversas` e `interacoes`, `src/jobs/expurgo.js` | [Contrato](../docs/contracts/conversa.md) |
| Métricas | Camadas `analytics` | [Analytics](analytics/README.md) |
| Banco | `prisma/schema.prisma` e `prisma/migrations` | Instruções abaixo |

A API local usa porta padrão 3001. No Docker, a porta interna é 3000, exposta no host em 3001. Copie [`.env.example`](.env.example) e configure o ambiente antes de iniciar. O frontend deve apontar `VITE_API_URL` para a API.

A configuração do banco real e dos serviços externos não é comprovada pela presença do código. O trabalho restante está em [pendências](../docs/pendencias.md).

## Contratos atuais

- `GET /campanhas/ativas` retorna `id` (chave real do banco), `campanhaId` (slug da matéria), `nome` e `descricao`. A telefonia usa o slug para escolher o agente e o ID real para registrar a campanha.
- `POST /interacoes` exige `Authorization: Bearer <INTERNAL_API_KEY>`. O contrato principal finaliza uma reserva com `conversa_id` e `turno_token`; o payload legado com `call_sid` continua aceito por um adaptador. Ambos persistem no mesmo histórico com vencimento em 168 horas; o identificador original da chamada não é armazenado.
- `GET /rag/search` exige `RAG_INTERNAL_TOKEN` e resolve o slug ou ID da campanha para o ID real usado na indexação. O cliente RAG real continua pendente; `WATSONX_MOCK=true` usa o índice temporário em memória.
- Analytics aceita slug da matéria ou ID real da campanha, usa `recebida_em` para datas e exclui registros vencidos ou ainda em processamento.
- As rotas `/internal/conversas` usam `INTERNAL_API_KEY`, que deve ser igual nos dois serviços. Consulte os dois arquivos `.env.example` para as demais variáveis.

### Instalação e verificação

```bash
npm ci
npm run prisma:generate
npm test
```

Os testes HTTP carregam a aplicação e verificam autenticação, validação e despacho dos dois contratos de interação. Para verificar as rotas com PostgreSQL real, use um banco **local de teste**, já migrado, com ao menos um slug de matéria livre:

```bash
TEST_DATABASE_URL=postgresql://usuario:senha@127.0.0.1:5432/fala_test npm run test:integration
```

Esse comando cria e remove apenas os registros de teste da sua execução, testa contexto, idempotência, compatibilidade legada, analytics e busca RAG simulada. Não chama IBM, Twilio ou ElevenLabs.

### Migrations e atualização de ambiente

A migration `20241023000004_add_interacoes` permanece inalterada. A migration de memória agora **estende** essa tabela, preserva IDs, perguntas, respostas e ordem das chamadas antigas, converte slug em FK quando a campanha ainda existe e substitui o identificador da chamada por associação aleatória. O prazo de sete dias parte da data original do registro, sem ser renovado pela migração.

Antes de atualizar um banco existente, confira `npx prisma migrate status`. Se a versão anterior de `20261104000000_add_memoria_conversa` já tiver sido aplicada isoladamente em outra branch, o banco precisa de reconciliação específica: não reaplique a migration modificada nem altere manualmente o histórico de migrations. Para bancos com apenas as migrations de 2024, ou bancos novos, a sequência foi validada em PostgreSQL 16.

`DATABASE_URL` é a conexão da aplicação e `DIRECT_URL` é a conexão direta usada nas migrations. O Compose configura as duas para o PostgreSQL local e fixa a porta interna do backend em 3000; o acesso no host continua em 3001.
