# Evoluções opcionais

Estas propostas não fazem parte do fluxo básico já implementado. Integrações necessárias para operar o MVP, como banco real e RAG remoto, estão em [pendências](pendencias.md).

| Evolução | Trabalho ainda necessário |
| --- | --- |
| Dados e score de municípios | Definir fontes públicas adequadas, normalização, critérios de score, agente, job em lote, persistência e validação. Escopo inicial em [data-pipeline](../data-pipeline/README.md) e [agent-score](../watsonx/agent-score/README.md). |
| Mapa de regiões | Criar API de municípios e interface de mapa após existir uma base de scores validada. |
| Analytics pedagógico avançado | Definir indicadores, alertas de qualidade e feedback do aluno. Para horizontes maiores que sete dias, definir agregação e retenção sem conservar transcrições individuais. |
| Escala e observabilidade | Evoluir fila de documentos e estado temporário de voz para execução distribuída, instrumentar etapas e validar comportamento sob carga. Os bloqueios atuais de concorrência da memória continuam no backlog principal. |
| Evolução do STT | Comparar reconhecimento de fala com sotaques e ruído usando avaliação controlada. O TTS opcional ElevenLabs, cache de mensagens fixas e uso de `<Play>` já existem e não são tarefas futuras de implementação básica. |
| Número gratuito e retorno de chamada | Decidir o modelo de acesso, verificar disponibilidade e condições no provedor e implementar callback se adotado. O número exibido no painel não comprova provisionamento de uma linha gratuita. |
| Continuidade entre ligações | Definir identificação do aluno, acesso ao histórico e política de dados antes de implementar personalização entre chamadas. A memória atual é por ligação. |
| Gravação da voz do aluno | Definir necessidade pedagógica, permissões, acesso, armazenamento e retenção antes de criar o recurso. O áudio temporário gerado pelo TTS atual não é gravação do aluno. |

Cada evolução precisa de escopo e critérios próprios antes de entrar em desenvolvimento. Os planos de execução do MVP já absorvidos pelo código foram removidos da documentação ativa.
