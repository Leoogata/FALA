# Agentes IBM

Esta pasta contém os prompts, contratos JSON e casos de teste do Ponte. Os clientes HTTP ficam no [serviço de voz](../backend/telephony-handler/README.md).

- [Agentes educacionais](agent-educational/README.md): um orquestrador e cinco subagentes de matéria.
- [Configuração exigida pelo cliente](agent-educational/README-config.md).
- [Prompts atuais](agent-educational/system-prompt.md).
- [Schema de entrada e saída](agent-educational/schema.json).
- [Agente de score](agent-score/README.md): expansão futura para dados de municípios.

Os arquivos locais não sincronizam automaticamente os deployments publicados. A validação do ambiente e a implementação RAG remota estão em [pendências](../docs/pendencias.md).
