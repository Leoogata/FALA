# Fluxo atual da ligação

O aluno faz perguntas livremente, sem selecionar uma matéria em menu. As mensagens efetivas são configuradas em `backend/telephony-handler/src/config.js`; o XML é construído em `services/twiml.js`.

## Estados

| Estado | Ação | Próxima etapa |
| --- | --- | --- |
| Entrada | Identificar ligação, criar/recuperar conversa e convidar a perguntar | Captura de voz com token |
| Captura válida | Sanitizar pergunta, reservar turno e recuperar contexto | Orquestrador |
| Captura vazia ou baixa confiança | Incrementar tentativas sem apagar histórico | Nova captura ou encerramento |
| Roteamento | Identificar matéria com pergunta e histórico | Subagente, esclarecimento ou reformulação |
| Resposta | Buscar contexto RAG disponível e consultar subagente | Finalização no banco |
| Esclarecimento | Salvar a pergunta curta de esclarecimento | Nova captura com contexto |
| Finalização | Confirmar resultado e preparar áudio/TwiML | Nova captura ou término |
| Tecla sem fala | Encerrar conversa | Fim |
| Indisponibilidade do banco | Informar indisponibilidade | Fim |
| Callback de término | Encerrar conversa e limpar estado local | Histórico permanece até vencer |

## Continuidade

Depois de uma resposta, o aluno pode usar referências como “ele”, “sua eleição” ou “por quê?”. O histórico inclui a pergunta e a resposta anteriores, não apenas a matéria. Uma mudança explícita de assunto permite trocar de agente.

Cada captura usa um token emitido pelo servidor na URL de ação. Exemplos de XML sem esse token não representam o contrato atual. A memória pertence à ligação, não a um perfil de aluno entre chamadas.

## Fallbacks

- Falha de reconhecimento: pedir repetição, até `VOICE_MAX_RETRIES`.
- Falta de rota: pedir reformulação.
- Falta de conteúdo: usar a mensagem de ausência de resposta.
- Referência ambígua: formular uma pergunta curta de esclarecimento.
- Falha de geração de áudio: usar `<Say>`/Polly para o texto preparado.

O backend precisa estar disponível para registrar os turnos. O RAG remoto ainda não está implementado, portanto testes com o índice em memória não comprovam respostas apoiadas em um acervo remoto persistente.

## Referências

- [Webhooks e campos](webhook-contract.md).
- [Configuração do provedor](provider-setup.md).
- [Limitações e trabalho restante](../docs/pendencias.md).
