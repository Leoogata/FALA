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

Para iniciar backend, telefonia e painel juntos, configure os arquivos `.env` dos dois serviços e execute na raiz:

```sh
./iniciar.sh
```

O script instala dependências ausentes, atualiza o cliente Prisma e mostra os logs dos três serviços. Acesse o painel em `http://localhost:5173`. Use **Ctrl+C** para encerrar tudo; se um serviço falhar, os demais também são encerrados. O banco Supabase e o deployment IBM são os configurados nos arquivos `.env`.

Se precisar mudar as portas, use `FALA_BACKEND_PORT`, `FALA_TELEFONIA_PORT` e `FALA_FRONTEND_PORT`. Veja `./iniciar.sh --help`.

1. [Arquitetura e funcionamento atual](docs/architecture.md).
2. [Instalação e atualização do backend](backend/README.md).
3. [Configuração do handler de voz](backend/telephony-handler/README.md).
4. [Pendências de implementação e aplicação](docs/pendencias.md).

As funcionalidades presentes no código não comprovam que migrations, prompts ou configurações já estejam publicados nos ambientes externos.
