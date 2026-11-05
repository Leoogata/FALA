# Histórico e analytics

O código está em `backend/src`. Memória e analytics compartilham a tabela `interacoes`; não existem bancos ou processos separados para esses módulos.

## Persistência

O handler reserva o turno e confirma o resultado por `POST /interacoes`, autenticado com `INTERNAL_API_KEY`. O mesmo endpoint aceita o contrato legado por um adaptador que também usa conversas e prazo de 168 horas. O identificador original da chamada não é persistido como campo do histórico atual.

Perguntas e respostas passam por sanitização heurística. A presença desses controles não garante que todo texto livre esteja anonimizado; reforço e testes restantes estão no backlog.

## Consulta

`GET /analytics/campanhas/:campanhaId` aceita slug da matéria ou ID real e retorna:

- `totalInteracoes` e `percentualSemResposta`;
- `topPerguntas`, com frequência por texto;
- `volumePorDia`, com contagens por data.

As consultas excluem registros vencidos e ainda em processamento. O ranking de perguntas ignora textos suprimidos. A resposta é agregada, mas pode incluir a pergunta sanitizada; não é uma API pública de transcrições individuais.

A rotina atual de expurgo roda no processo web. Retenção em backups, agendamento independente e tela de métricas ainda precisam ser concluídos.

- [Contrato de conversa](../../docs/contracts/conversa.md).
- [Pendências](../../docs/pendencias.md).
- [Instalação e migrations](../README.md).
