# Pendências de implementação e aplicação

> Atualização: arquitetura de agente único implementada. Consulte o [guia de implantação](nova-arquitetura-implantacao.md) para o fluxo, as variáveis e as migrations atuais. Menções abaixo ao orquestrador ou ao RAG simulado descrevem o fluxo anterior.

Revisão de 05/11/2026, com base no código local. Este arquivo concentra apenas o trabalho que ainda precisa ser feito ou comprovado. Os planos antigos não são uma segunda lista de tarefas.

## 1. Atualizar o banco do ambiente da aplicação

**Situação:** schema, migration e conversão de histórico foram testados em PostgreSQL temporário. O banco real não foi atualizado nesta sessão e seu histórico de migrations ainda precisa ser conferido.

- [ ] Consultar o estado das migrations no ambiente de destino.
- [ ] Aplicar as migrations pendentes quando a estrutura anterior for compatível.
- [ ] Se a antiga migration de memória já tiver sido aplicada isoladamente em outra branch, preparar a reconciliação específica antes da atualização.
- [ ] Verificar criação de conversa, reserva, conclusão e leitura do próximo turno no ambiente atualizado.

**Conclusão:** código e banco do ambiente operam com `conversas` e a estrutura unificada de `interacoes`, preservando o histórico anterior. Procedimento e ressalva de versões: [backend](../backend/README.md#migrations-e-atualização-de-ambiente).

## 2. Implementar o RAG remoto

**Situação:** upload, extração, OCR, chunking, fila, busca HTTP e injeção de contexto existem. `realClient` ainda lança erro; o cliente funcional é um índice simulado em memória.

- [ ] Escolher e configurar o armazenamento vetorial do ambiente.
- [ ] Conferir as definições de RAG do schema geral dos agentes contra a interface já consumida pelo backend.
- [ ] Implementar `indexChunks`, `search` e `deleteDocumentChunks` conforme o [contrato](contracts/watsonx-client.md).
- [ ] Validar isolamento por campanha, reindexação sem duplicação e remoção idempotente.
- [ ] Garantir recuperação dos materiais indexados depois de reiniciar os serviços.
- [ ] Fazer a busca considerar a referência resolvida pelo histórico em perguntas de continuidade.
- [ ] Testar com conteúdo didático validado antes de ativar `WATSONX_MOCK=false`.

**Conclusão:** o aluno recebe respostas fundamentadas nos materiais persistidos da campanha, inclusive após reinício.

## 3. Publicar e validar os agentes e a telefonia

**Situação:** clientes, prompts e schema existem no repositório. A publicação e a configuração das contas externas não foram verificadas nesta revisão.

- [ ] Conferir os seis deployments indicados nas variáveis de ambiente e publicar os prompts atuais, quando necessário.
- [ ] Confirmar a variável `input` e o recebimento de `historico`, além dos campos de esclarecimento na saída.
- [ ] Definir `VERSAO_PROMPT` para rastrear o conjunto de prompts em uso.
- [ ] Validar uma pergunta inicial, uma continuação, uma ambiguidade e uma mudança de matéria usando os endpoints publicados.
- [ ] Conferir os webhooks de entrada e de término, assinatura e URL pública do serviço de voz.
- [ ] Medir latência e testar fallback de áudio e indisponibilidade em uma ligação real de homologação.

**Conclusão:** o ciclo completo funciona no ambiente configurado. Referências: [agentes](../watsonx/agent-educational/README-config.md) e [telefonia](../telephony/provider-setup.md).

## 4. Concluir os controles da memória

**Situação:** fluxo sequencial, persistência, histórico, replay de respostas concluídas e recuperação de reservas vencidas estão implementados. Permanecem os casos abaixo.

- [ ] Devolver `execucao_id` na reserva, transportá-lo até a finalização e verificar atomicamente o proprietário e a validade do lease. Uma execução antiga não pode concluir um turno retomado por outra.
- [ ] Impedir processamento simultâneo de tokens diferentes na mesma conversa, para que o próximo turno não use contexto incompleto.
- [ ] Verificar o vencimento da interação ao reproduzir ou retomar um token, além do vencimento da conversa. Um atraso do expurgo não pode liberar texto vencido.
- [ ] Aplicar os limites de histórico à representação serializada enviada ao modelo; hoje o limite de caracteres soma os textos.
- [ ] Alinhar a entrada real ao schema dos agentes, incluindo campos extras na lista de campanhas.
- [ ] Fortalecer os validadores de saída dos agentes para rejeitar campos de esclarecimento com tipos ou combinações incoerentes.
- [ ] Ampliar testes de sanitização contextual, sem apagar números de exercícios ou nomes pedagógicos. Não tratar HMAC ou expressões regulares como garantia de anonimização do texto.
- [ ] Cobrir esses cenários com testes de concorrência, falhas e relógio controlado.

**Conclusão:** isolamento, recuperação, retenção e orçamento de contexto continuam corretos em retries, concorrência e falhas. Funcionamento atual: [contrato de conversa](contracts/conversa.md).

## 5. Completar a operação da retenção

- [ ] Executar o expurgo por worker/agendador independente do processo web, com coordenação entre instâncias.
- [ ] Monitorar o registro vencido mais antigo aguardando exclusão e alertar sobre falhas reais do job.
- [ ] Conferir logs, caches, backups e snapshots para que não mantenham texto além da política de sete dias.
- [ ] Considerar o vencimento original em cópias: manter um snapshot por sete dias não garante sete dias por interação.
- [ ] Executar expurgo antes de disponibilizar dados restaurados.

**Conclusão:** a retenção é aplicada também fora das consultas normais do banco e durante indisponibilidade, restauração ou múltiplas instâncias.

## 6. Concluir a integração do painel

O painel de gestão existe. Os pontos restantes dos planos antigos são:

- [ ] Permitir associar a matéria/slug pelo painel, sem depender apenas de seed ou chamada manual da API.
- [ ] Alinhar a regra de ativação: rascunho inicial, instruções e documento pronto, e desativação quando o último material pronto for removido. O backend atual não impõe todo esse fluxo esperado pela interface.
- [ ] Alinhar validação de uploads com a interface: nome duplicado e respostas para tipo e tamanho inválidos.
- [ ] Substituir os stubs de `POST /instrucoes/melhorar` e `POST /campanhas/:id/testar` pelas integrações de IA.
- [ ] Definir como instruções editadas no painel serão usadas pelo agente publicado.
- [ ] Verificar a navegação completa contra a API real, incluindo estados vazios, erros e processamento de documentos.
- [ ] Homologar teclado, contraste e layout em largura de 375 px; a existência das telas não comprova essa validação.
- [ ] Implementar a tela de métricas da US-10; seus endpoints já existem.

**Conclusão:** criar, preparar, ativar, testar e acompanhar um agente funciona no painel com o backend real. [Guia do painel](../frontend/README.md).

## Fora do fluxo básico

Scoring de municípios, mapa de regiões, identidade do aluno entre chamadas e outras expansões ficam em [evoluções opcionais](future-evolutions.md).
