# Instalação da arquitetura de agente único

## 1. Backend

Na pasta `backend`, configurar no `.env`:

```dotenv
WATSONX_DEPLOYMENT_ID=01a1ac2a-64c7-748f-8215-d80978470715
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_API_KEY=<chave IBM do projeto>
WATSONX_PROJECT_ID=<projeto IBM>
WATSONX_MOCK=false
WATSONX_EMBEDDING_MODEL=ibm/granite-embedding-278m-multilingual
VERSAO_PROMPT=agente-unico-v1
```

A chave IBM fica somente no backend. As credenciais locais existentes no serviço de telefonia foram reaproveitadas no `.env` local da API durante a implementação, sem inclusão no Git. Ambientes remotos precisam receber essa configuração.

O endpoint é `/ml/v1/deployments/<id>/text/generation?version=2021-05-01`, sem streaming. O template deve conter a variável `input`; o JSON dentro dela usa `modo`, `instrucoes`, `contexto_rag`, `historico`, `pergunta`.

## 2. Banco

Executar pelo processo de implantação já usado no ambiente:

```sh
npm run prisma:generate
npx prisma migrate deploy
```

As migrations estruturais `20261103000000_create_conversas` e `20261103000001_create_documento_trechos` criam as tabelas e habilitam pgvector. A etapa `20261103000002_protect_conversas` protege a tabela de conversas. A migração `20261105000000_agente_unico` conclui a transição dos dados e a regra de publicação única. Em Supabase, a extensão pode estar em `extensions`; o cliente detecta o schema. A tabela de trechos tem RLS habilitado sem acesso direto para clientes; a conexão administrativa da API é responsável pelas consultas com escopo escolar. No Compose local, a imagem passa a ser `pgvector/pgvector:pg16`.

**Estado do Supabase em 05/11/2026:** todas as 11 migrations foram aplicadas e registradas no Prisma. A criação estrutural foi seguida da conversão autorizada pelo usuário. Foram preservadas 2 escolas, 15 campanhas, 14 documentos e as perguntas/respostas das 49 interações. O histórico foi organizado em 21 conversas encerradas. Os 6 agentes escolares antigos foram desativados; é necessário publicar um agente com materiais por escola. Não havia materiais escolares prontos a reenfileirar nesta migração. A proteção de acesso das tabelas novas e a restrição de publicação única estão ativas. O próximo passo operacional é iniciar/reiniciar os serviços atualizados e configurar/publicar os agentes escolares no painel.

**Efeitos deliberados das etapas de conversão:**

- Preserva agentes, documentos e interações existentes.
- Desativa os agentes escolares antigos para que a escola escolha o único agente a publicar.
- Encerra conversas antigas ainda abertas, pois elas não tinham vínculo escolar persistido.
- Marca materiais escolares antes `PRONTO` como `PROCESSANDO`, para reconstruir o índice persistente na inicialização da API. Os arquivos originais precisam estar no volume de uploads.
- Impede excluir uma escola deixando seus agentes como conteúdo geral.

Não executar `prisma db push` no lugar da migration: a unicidade de publicação utiliza um índice parcial SQL.

## 3. Acesso ao painel

Para cada escola já cadastrada, executar na pasta `backend`:

```sh
npm run escola:chave -- 1001
```

Esse comando adiciona uma chave aleatória a `SCHOOL_API_TOKENS` no `.env` local e não imprime a chave. Consulte esse campo para entregar a credencial à escola por um canal apropriado. Executar novamente não troca uma chave existente. As chaves locais para os códigos de demonstração 1001 e 2002 já foram preparadas durante a implementação. Em hospedagem remota, configurar o mesmo JSON no gerenciador de variáveis do serviço.

Formato:

```text
SCHOOL_API_TOKENS='{"1001":"<segredo exclusivo com pelo menos 32 caracteres>"}'
```

Reiniciar o backend após alterar as variáveis. As chaves devem ser diferentes entre escolas.

No frontend, configurar `VITE_API_URL` e `VITE_USE_MOCK=false`. Entrar usando a chave administrativa. O nome/código exibidos vêm da escola autenticada, substituindo a escola fictícia do protótipo.

Criar ou escolher um agente, configurar instruções, enviar materiais e aguardar `PRONTO`. Testar e ativar. A ativação substitui o agente anterior para novas ligações. Sem código, o aluno utiliza sempre o padrão sem RAG; escola válida sem agente publicado recebe indisponibilidade.

## 4. Telefonia

Manter `BACKEND_API_URL`, `INTERNAL_API_KEY`, HMAC, Twilio e TTS. A telefonia não precisa mais de chaves IBM, IDs por matéria ou ID do orquestrador. A API precisa das credenciais IBM.

A relação escola/agente vive no banco. Sessão de tentativas STT e cache TTS continuam locais ao processo; para múltiplas instâncias, usar afinidade de sessão ou armazenamento compartilhado desses recursos.

## 5. Verificações

```sh
# backend
npm test
# telephony-handler
npm test
# frontend
npm run build
```

Para integração completa em um banco **local e descartável**, aplicar as migrations nele e executar:

```sh
TEST_DATABASE_URL=postgresql://usuario:senha@127.0.0.1:5432/fala_test npm run test:integration
```

O script usa HTTP, Prisma, uploads e pgvector reais, simulando somente as respostas externas da IBM. Verifica duas escolas com o mesmo slug, publicação única, reindexação idempotente, resposta compartilhada voz/painel, histórico e recuperação de conversa. Nunca permite URL de banco remoto.

Referências: [embeddings IBM](https://www.ibm.com/docs/en/watsonx/saas?topic=models-supported-embedding), [pgvector](https://github.com/pgvector/pgvector).
