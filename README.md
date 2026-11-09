# FALA — Projeto Ponte

> Atualização: arquitetura de agente único implementada. Consulte o [guia de implantação](docs/nova-arquitetura-implantacao.md) para o fluxo, as variáveis e as migrations atuais. Menções abaixo ao orquestrador ou ao RAG simulado descrevem o fluxo anterior.

Plataforma de apoio educacional por telefone. O aluno informa opcionalmente o código da escola e faz uma pergunta em voz. Um único agente educacional responde com conhecimento geral ou com os materiais da escola, conforme a configuração. O aluno pode continuar o assunto na mesma ligação.

## Estado atual

O repositório contém painel web, API de campanhas e documentos, handler de voz, clientes dos agentes IBM, memória de conversa e endpoints de analytics. A arquitetura usa um único deployment IBM e RAG escolar persistente em PostgreSQL/pgvector. O Supabase já recebeu as migrations da nova arquitetura; iniciar os serviços atualizados e publicar os agentes escolares conforme o guia de implantação.

## Estrutura

| Diretório | Conteúdo |
| --- | --- |
| [backend](backend/README.md) | API Node.js/Express, PostgreSQL/Prisma, documentos, memória, analytics e pipeline RAG |
| [backend/telephony-handler](backend/telephony-handler/README.md) | Serviço de voz separado, com Twilio, clientes watsonx e TTS |
| [frontend](frontend/README.md) | Painel React/TypeScript para gerir agentes e materiais |
| [watsonx](watsonx/README.md) | Prompts, contratos JSON e casos de teste dos agentes |
| [telephony](telephony/README.md) | Configuração e contratos dos webhooks de voz |
| [docs](docs/README.md) | Arquitetura, contratos e trabalho restante |
| [data-pipeline](data-pipeline/README.md) | Escopo futuro de dados e scoring de municípios |
| [design](design/README.md) | Referências visuais e de produto |

## Por onde começar

### Pré-requisitos

- **Node.js 20+** — verifique com `node --version`
- **npm** — incluído no Node.js
- Conta **PostgreSQL** acessível (Supabase ou local) com as migrations aplicadas
- Credenciais IBM watsonx, Twilio e ElevenLabs (opcionais para desenvolvimento)

### 1. Copiar os arquivos de variáveis de ambiente

```sh
cp backend/.env.example          backend/.env
cp backend/telephony-handler/.env.example  backend/telephony-handler/.env
```

O frontend não precisa de `.env` próprio — o `iniciar.sh` injeta `VITE_API_URL` e `VITE_USE_MOCK` automaticamente.

### 2. Preencher os `.env`

Edite `backend/.env` e `backend/telephony-handler/.env` com os valores reais:

| Arquivo | Variáveis obrigatórias |
| --- | --- |
| `backend/.env` | `DATABASE_URL`, `DIRECT_URL`, `INTERNAL_API_KEY`, `RAG_INTERNAL_TOKEN` |
| `backend/telephony-handler/.env` | `INTERNAL_API_KEY` (igual ao backend), `BACKEND_API_URL`, `HMAC_SECRET` |

Gere chaves aleatórias com:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Iniciar tudo com um único comando

Na raiz do repositório:

```sh
./iniciar.sh
```

O script:
- verifica os pré-requisitos (Node 20+, portas livres, `.env` presentes)
- instala dependências ausentes em cada módulo
- atualiza o cliente Prisma (`prisma generate`)
- inicia backend, telephony-handler e painel em paralelo, com logs prefixados por serviço

Acesse o painel em `http://localhost:5173`. Use **Ctrl+C** para encerrar os três serviços ao mesmo tempo.

### Portas e variáveis de ambiente opcionais

| Variável | Padrão | Serviço |
| --- | --- | --- |
| `FALA_BACKEND_PORT` | `3001` | API backend |
| `FALA_TELEFONIA_PORT` | `3000` | Telephony handler |
| `FALA_FRONTEND_PORT` | `5173` | Painel web |

```sh
FALA_BACKEND_PORT=4001 ./iniciar.sh
```

Veja todas as opções com `./iniciar.sh --help`.

### Referências detalhadas

1. [Arquitetura e funcionamento atual](docs/architecture.md).
2. [Instalação e atualização do backend](backend/README.md).
3. [Configuração do handler de voz](backend/telephony-handler/README.md).
4. [Pendências de implementação e aplicação](docs/pendencias.md).

As funcionalidades presentes no código não comprovam que migrations, prompts ou configurações já estejam publicados nos ambientes externos.
