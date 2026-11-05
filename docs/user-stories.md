# Escopo do produto

O Ponte oferece apoio educacional por telefone e um painel de gestão para a escola. Este documento é um mapa das capacidades; tarefas de implementação e aplicação ficam somente em [pendências](pendencias.md).

## Capacidades e estado no repositório

| Referência | Capacidade | Estado |
| --- | --- | --- |
| US-04 | Gerir campanhas/agentes e documentos pela API | Implementada; regras de ativação e integração com o painel ainda precisam ser alinhadas |
| US-05 | Preparar e indexar material didático por campanha | Pipeline implementado; cliente vetorial remoto pendente |
| US-06 | Painel escolar de gestão de agentes e materiais | Telas implementadas; integração e homologação pendentes |
| US-07 | Receber ligação e capturar pergunta livre | Handler e documentação disponíveis; configuração do provedor precisa de validação no ambiente |
| US-08-agent | Identificar matéria e responder com contexto | Prompts e clientes disponíveis; publicação, conteúdo e validação ponta a ponta pendentes |
| US-08-handler | Executar ciclo de voz e permitir continuação | Implementado no código, incluindo memória e fallback de áudio |
| US-09 | Guardar histórico por ligação para análise | Implementado no código; aplicação no banco real e controles restantes estão no backlog |
| US-10 | Consultar métricas educacionais | API implementada; tela de métricas pendente |
| US-01 | Coletar e normalizar dados públicos de municípios | Expansão futura |
| US-02 | Calcular score de regiões com justificativa | Expansão futura |
| US-03-back | Executar scoring em lote e persistir resultados | Expansão futura |
| US-03-front | Visualizar mapa de sensibilidade das regiões | Expansão futura |

## Regras centrais

- O aluno pode fazer perguntas consecutivas na mesma ligação, usando o contexto anterior.
- A matéria é identificada pela pergunta e pelo contexto; não há menu inicial de matérias.
- Respostas devem usar linguagem adequada ao ensino fundamental e médio e ser curtas para leitura em voz.
- O agente deve admitir falta de conteúdo ou pedir esclarecimento quando necessário.
- Documentos e interações são associados à campanha correta; o slug da matéria não substitui seu ID no banco.
- O histórico individual tem política de sete dias. Análise futura de períodos maiores depende de especificação própria para métricas agregadas.
- Retomar um aluno em outra chamada e gravar a voz do aluno não fazem parte do fluxo atual.

## Referências

- [Funcionamento e arquitetura](architecture.md).
- [Trabalho restante e critérios de conclusão](pendencias.md).
- [Expansões opcionais](future-evolutions.md).
