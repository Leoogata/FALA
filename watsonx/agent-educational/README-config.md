# Configuração do agente educacional único

O backend chama um único prompt template publicado em watsonx.ai pelo endpoint não streaming `/ml/v1/deployments/:id/text/generation?version=2021-05-01`.

- Deployment: `WATSONX_DEPLOYMENT_ID`.
- Autenticação: `WATSONX_API_KEY`, mantida na API, com cache do token IAM.
- Entrada: `parameters.prompt_variables.input`, contendo JSON serializado com `modo`, `instrucoes`, `contexto_rag`, `historico`, `pergunta`.
- Saída obrigatória: `resposta`, `confianca`, `sem_resposta`, `precisa_esclarecimento`, `pergunta_esclarecimento`.
- `resposta` tem limite de 1000 caracteres e esclarecimento de 300.
- Ausência de resposta: texto vazio, confiança 0 e `sem_resposta=true`.
- Esclarecimento: ausência de resposta e pergunta curta preenchida.

`modo=padrao` permite conhecimento geral das matérias do ensino fundamental. `modo=escola` usa as instruções e os documentos fornecidos. O backend já impede geração sem evidência no modo escolar; falha de busca é tratada como indisponibilidade.

Nenhum deployment extra é necessário quando uma escola cria um agente. A personalização vive no banco e chega ao mesmo template a cada pergunta. Não há sincronização automática entre os arquivos de prompt locais e a interface IBM.

Instalação: [guia da nova arquitetura](../../docs/nova-arquitetura-implantacao.md).
