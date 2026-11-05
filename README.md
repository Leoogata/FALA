# FALA — Projeto Ponte

Plataforma de apoio educacional por telefone. O aluno faz uma pergunta em voz e o sistema identifica a matéria, consulta o agente educacional e devolve áudio. O aluno pode continuar o assunto na mesma ligação.

## Estado atual

O repositório contém painel web, API de campanhas e documentos, handler de voz, clientes dos agentes IBM, memória de conversa e endpoints de analytics. A integração RAG do backend ainda usa um cliente simulado; a versão remota precisa ser implementada. A atualização do banco real e a configuração dos serviços externos ainda precisam ser verificadas/aplicadas.

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

1. [Arquitetura e funcionamento atual](docs/architecture.md).
2. [Instalação e atualização do backend](backend/README.md).
3. [Configuração do handler de voz](backend/telephony-handler/README.md).
4. [Pendências de implementação e aplicação](docs/pendencias.md).

As funcionalidades presentes no código não comprovam que migrations, prompts ou configurações já estejam publicados nos ambientes externos.
