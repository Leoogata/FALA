# Configuração dos agentes usada pelo código atual

Este guia descreve o contrato exigido pelo cliente HTTP do repositório. Não comprova que os prompts já estejam publicados na conta IBM.

## Artefatos

| Deployment lógico | Seção de `system-prompt.md` | Variável no handler |
| --- | --- | --- |
| `fala-orchestrator` | Agente Orquestrador | `WATSONX_AGENT_ORCHESTRATOR_ID` |
| `fala-agent-historia` | Subagente — História | `WATSONX_AGENT_ID_HISTORIA` |
| `fala-agent-geografia` | Subagente — Geografia | `WATSONX_AGENT_ID_GEOGRAFIA` |
| `fala-agent-portugues` | Subagente — Português | `WATSONX_AGENT_ID_PORTUGUES` |
| `fala-agent-matematica` | Subagente — Matemática | `WATSONX_AGENT_ID_MATEMATICA` |
| `fala-agent-ciencias` | Subagente — Ciências | `WATSONX_AGENT_ID_CIENCIAS` |

O código chama templates implantados pelo endpoint `/ml/v1/deployments/:id/text/generation`. Os valores acima precisam apontar para deployments compatíveis com esse contrato.

## Variável de entrada

Cada template usa uma variável `input`. O handler envia o JSON serializado em `parameters.prompt_variables.input`.

Depois do prompt correspondente, a entrada do template deve incluir:

```text
Entrada:
{input}

Saída:
```

O campo `historico` faz parte desse JSON; não é uma segunda variável de template.

- Orquestrador: `pergunta`, `campanhasAtivas`, `historico`.
- Subagente: `campanhaId`, `pergunta`, `historico`.
- A pergunta do subagente pode conter contexto recuperado dos documentos.

## Saída

Ambos retornam somente JSON. Os tipos, campos e limites estão em [schema.json](schema.json), nas definições `RouteQuestionOutput` e `AnswerQuestionOutput`.

| Situação | Campos relevantes |
| --- | --- |
| Roteamento normal | `campanhaId` válido, `confianca`, `sem_rota: false`, `precisa_esclarecimento: false`, `pergunta_esclarecimento: ""` |
| Esclarecimento do orquestrador | `sem_rota: true`, `precisa_esclarecimento: true`, pergunta curta e `campanhaId` entre as campanhas ativas |
| Resposta educacional | Texto em `resposta`, confiança, `sem_resposta: false` e esclarecimento desativado |
| Esclarecimento educacional | `resposta: ""`, `confianca: 0`, `sem_resposta: true`, `precisa_esclarecimento: true` e pergunta curta |
| Falta de conteúdo validado | `resposta: ""`, `confianca: 0`, `sem_resposta: true` e esclarecimento desativado |

Os prompts atuais estão em [system-prompt.md](system-prompt.md). A regra de falta de material validado não deve ser removida apenas para forçar uma resposta na demonstração.

## Publicação e teste

1. Conferir o prompt de cada deployment com a seção local correspondente, incluindo as regras de histórico.
2. Confirmar que o endpoint publicado usa essa versão e a variável `input`.
3. Conferir os IDs e `WATSONX_API_KEY` no ambiente do handler; registrar `VERSAO_PROMPT` para rastrear o conjunto em uso.
4. Testar primeira pergunta com histórico vazio; continuação com referência implícita; ambiguidade; mudança de matéria; falta de conteúdo; e resposta com material validado.
5. Validar a integração pelo handler, além dos testes isolados na plataforma.

Credenciais ficam no arquivo de ambiente, sem valores reais em exemplos versionados. O contexto de conversa é recuperado pelo backend; publicar os prompts não implementa por si só a busca RAG nem a retenção no banco.

## RAG

O contrato do cliente remoto está em [watsonx-client.md](../../docs/contracts/watsonx-client.md). Upload de documentos, indexação persistente e ligação do índice ao fluxo usado pela aplicação ainda precisam ser concluídos conforme o [backlog](../../docs/pendencias.md#2-implementar-o-rag-remoto).
