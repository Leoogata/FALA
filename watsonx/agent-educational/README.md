# Agentes educacionais

O fluxo usa um orquestrador e cinco subagentes: História, Geografia, Português, Matemática e Ciências. São chamados pelo serviço de voz usando IDs de deployments configurados no ambiente.

## Contrato atual

- Orquestrador: recebe `{ pergunta, campanhasAtivas, historico }` e devolve matéria, confiança, ausência de rota e eventual pedido de esclarecimento.
- Subagente: recebe `{ campanhaId, pergunta, historico }`. O cliente pode enriquecer a pergunta com trechos recuperados pelo RAG.
- Saída educacional: `resposta`, `confianca`, `sem_resposta`, `precisa_esclarecimento` e `pergunta_esclarecimento`.

O histórico contém perguntas e respostas anteriores. Ele serve para resolver referências, não como fonte didática nem como instrução de sistema. O agente deve acompanhar mudanças de assunto e pedir esclarecimento se a referência continuar ambígua.

A regra dos prompts exige material validado para responder. O cliente vetorial remoto ainda não está implementado no backend; essa integração é uma pendência, não uma capacidade comprovada dos deployments atuais.

## Arquivos necessários

- [system-prompt.md](system-prompt.md): conteúdo por agente.
- [schema.json](schema.json): contrato de entrada e saída.
- [README-config.md](README-config.md): configuração e validação dos deployments.
- [test-cases](test-cases/README.md): exemplos para validação de comportamento.

Os testes dos clientes estão em `backend/telephony-handler/tests/watsonx-services.test.js`. A publicação e o teste real na IBM continuam sujeitos à [validação do ambiente](../../docs/pendencias.md#3-publicar-e-validar-os-agentes-e-a-telefonia).
