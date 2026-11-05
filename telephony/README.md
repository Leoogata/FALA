# Telefonia

Referências de configuração do Twilio e do fluxo de voz. A implementação fica em [backend/telephony-handler](../backend/telephony-handler/README.md).

O aluno faz uma pergunta livre; o orquestrador identifica a matéria. Não há menu inicial de campanhas. O fluxo já tem captura de fala, contexto de conversa, resposta, esclarecimento e fallbacks no código.

- [Configuração do ambiente e webhooks](provider-setup.md).
- [Fluxo de chamada](ivr-flow.md).
- [Contrato dos webhooks](webhook-contract.md).
- [Pendências de homologação](../docs/pendencias.md#3-publicar-e-validar-os-agentes-e-a-telefonia).

Provedor e formato de STT/TTS já estão definidos no código: Twilio para transporte/captura, ElevenLabs opcional para áudio e Polly como fallback. A configuração da conta, disponibilidade do número e execução real não são comprovadas pela documentação. Número gratuito e callback são evoluções opcionais.
