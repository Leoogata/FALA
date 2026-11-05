# Documentação do projeto

A documentação descreve o funcionamento atual e o trabalho restante. Planos de execução e prompts de implementação já absorvidos pelo código foram removidos; o histórico continua disponível no Git.

## Entendimento do projeto

- [Arquitetura](architecture.md): serviços, fluxo de voz, documentos e dados.
- [Escopo do produto](user-stories.md): capacidades e situação de cada área.
- [Backend](../backend/README.md): instalação, contratos e atualização do banco.
- [Frontend](../frontend/README.md): painel, configuração e modo simulado.
- [Telefonia](../telephony/README.md): fluxo e configuração do provedor.
- [Agentes educacionais](../watsonx/agent-educational/README.md): prompts e contrato com a IBM.

## O que falta

- [Pendências](pendencias.md): implementação, aplicação no ambiente e critérios para concluir cada item.
- [Evoluções opcionais](future-evolutions.md): funcionalidades futuras que não bloqueiam o fluxo básico.

## Contratos necessários

- [Memória e histórico](contracts/conversa.md).
- [Cliente RAG](contracts/watsonx-client.md).
- [Webhooks de voz](../telephony/webhook-contract.md).
- [Entradas e saídas dos agentes](../watsonx/agent-educational/schema.json).

As rotas da API também estão documentadas em `/api-docs` quando o backend está em execução. Segredos e credenciais pertencem aos arquivos de ambiente, nunca à documentação versionada.
