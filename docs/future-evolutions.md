# docs/future-evolutions.md — Evoluções Pós-MVP

Este documento registra as opções de evolução da plataforma FALA após a validação do MVP, com gatilhos mensuráveis, benefício esperado, custo/complexidade e análise comparativa. O objetivo é orientar decisões futuras sem especular antes da necessidade.

---

## 1. STT/TTS externos e voz mais natural

**Situação atual:** STT via `<Gather input="speech">` do Twilio (reconhecimento nativo) e TTS via `<Say voice="Polly.Camila">` (Amazon Polly sem custo adicional de infraestrutura).

**Evolução:** Substituir por provedores especializados como Google Cloud Speech-to-Text / Text-to-Speech, IBM watsonx Speech, Deepgram (STT), Eleven Labs ou Azure Neural TTS.

| Dimensão | Detalhe |
|----------|---------|
| **Benefício** | Maior precisão em sotaques regionais e ruídos de rede; voz mais natural e adequada para crianças |
| **Custo** | Custo por minuto ou por caractere dependendo do provedor; exige novo serviço de integração no handler |
| **Complexidade** | Média — o handler precisa de cliente para o novo provedor e lógica de streaming ou buffer de áudio |
| **Gatilho de adoção** | Taxa de erro STT (`Confidence < threshold`) acima de 15% em produção medida por 2 semanas consecutivas, ou NPS de experiência de voz abaixo de 6 |

---

## 2. Gravação opcional com consentimento (LGPD)

**Situação atual:** o MVP não grava nem armazena o áudio do aluno. Apenas a transcrição e os metadados de interação são persistidos.

**Evolução:** gravar o áudio do turno com consentimento explícito, armazená-lo de forma segura e permitir auditorias ou melhoria de modelo.

| Dimensão | Detalhe |
|----------|---------|
| **Benefício** | Auditoria pedagógica, detecção de erros de transcrição, melhoria de modelos de STT/LLM |
| **Custo** | Storage (GCP Bucket ou S3), criptografia em repouso e em trânsito, fluxo de consentimento na UI, política de retenção e exclusão |
| **Complexidade** | Alta — exige coleta de consentimento, política de privacidade atualizada, criptografia, retenção configurável e mecanismo de exclusão por solicitação (art. 18 LGPD) |
| **Cuidados LGPD** | Consentimento explícito antes do início da gravação (não apenas nos termos de uso); dados de voz são dados sensíveis quando combinados a dados pessoais do aluno; prazo máximo de retenção deve ser definido e aplicado automaticamente |
| **Gatilho de adoção** | Decisão legal/pedagógica explícita da equipe de produto + aprovação do DPO; não adotar apenas por conveniência técnica |

---

## 3. Uso de `<Play>` e armazenamento de áudio para vozes customizadas

**Situação atual:** TTS dinâmico via `<Say>` do Twilio (gerado em tempo real).

**Evolução:** pré-gravar áudios de alta qualidade (estúdio ou TTS de alta fidelidade), armazená-los e servir via `<Play>` para contextos onde a voz precisa ser consistente (ex: personagem da plataforma).

| Dimensão | Detalhe |
|----------|---------|
| **Benefício** | Voz consistente e de maior qualidade para prompts fixos (boas-vindas, fallback); possibilidade de personagem com identidade sonora |
| **Custo** | Storage para arquivos de áudio; processo de produção/atualização dos áudios; integração CDN para baixa latência |
| **Complexidade** | Baixa para prompts fixos; alta para respostas dinâmicas (exige TTS de alta fidelidade + cache) |
| **Gatilho de adoção** | Decisão de branding de produto que exija identidade sonora consistente; não antes de validar o conteúdo pedagógico com os alunos |

---

## 4. Alternativas de número e impacto de custo

| Opção | Descrição | Custo para o aluno | Custo para a plataforma | Complexidade |
|-------|-----------|-------------------|-----------------------|-------------|
| **Número local (atual MVP)** | Número com DDD regional; aluno usa minutos do plano | Usa minutos de chamada local | Baixo (número Twilio comum) | Baixa |
| **0800** | Número gratuito para o aluno | Zero | Alto (plataforma paga cada minuto + contratação com operadora parceira Twilio Brasil + documentação) | Alta — envolve processo burocrático com operadora |
| **Retorno de chamada (callback)** | Aluno solicita retorno; plataforma liga | Zero após solicitação | Plataforma paga cada chamada de saída | Média — exige fila de callback e lógica de discagem |
| **SIP/BYOC** | Trazer própria operadora SIP | Depende da operadora | Pode reduzir custo por minuto em escala; exige infraestrutura SIP | Alta — requer experiência com VoIP/SIP |

**Recomendação MVP:** permanecer com número local até validar demanda suficiente que justifique o custo de 0800.

**Gatilho para 0800:** volume acima de 10.000 minutos/mês e evidência (pesquisa) de que o custo da ligação é barreira de acesso para alunos.

---

## 5. Escalabilidade, limites de sessão e observabilidade

**Situação atual:** sessões de chamada mantidas em memória no processo Node.js; sem observabilidade de latência estruturada.

| Dimensão | Detalhes |
|----------|---------|
| **Sessões distribuídas** | Com múltiplas instâncias do handler, o `callSession.js` em memória deixa de funcionar. Solução: substituir por Redis com TTL por `CallSid` |
| **Limites Twilio** | Trial: ~1 chamada simultânea. Conta paga: limites por tier; verificar em **Console → Capacity** |
| **Filas** | Para picos de demanda, considerar fila de processamento (RabbitMQ, SQS) entre o webhook e a inferência watsonx; acrescenta complexidade mas protege contra timeouts |
| **Observabilidade** | Instrumentar latência de cada etapa (STT, roteamento, subagente) com OpenTelemetry ou equivalente; alertar quando P95 de latência total > 5s |
| **Gatilho** | Mais de 1 instância em produção, ou P95 de latência > 3s medido por 1 semana |

---

## 6. Autenticação do aluno e personalização

**Situação atual:** nenhuma autenticação — o aluno liga de qualquer número.

| Dimensão | Detalhe |
|----------|---------|
| **Autenticação por número** | Verificar o `From` do Twilio contra um cadastro de alunos autorizados — baixo custo, mas não impede fraude de caller ID spoofing |
| **PIN por voz** | Pedir PIN ao início da chamada via `<Gather input="dtmf">` — maior segurança com UX aceitável |
| **Personalização** | Com identidade do aluno, é possível adaptar o nível de linguagem, registrar histórico individual e monitorar progresso |
| **Gatilho** | Requisito de controle de acesso por instituição parceira, ou necessidade de histórico individual para relatórios pedagógicos |

---

## 7. Evolução do RAG e Analytics

### RAG

**Situação atual:** subagentes retornam `sem_resposta: true` enquanto não há material indexado.

| Evolução | Benefício | Gatilho |
|----------|-----------|---------|
| Indexar material didático via `watsonxClient.indexChunks` | Respostas baseadas no conteúdo real da campanha | Materiais didáticos disponibilizados pela equipe pedagógica |
| Ajuste de `topK` por matéria | Precisão ajustada por densidade do conteúdo | Avaliação de qualidade de resposta com amostra de perguntas reais |
| Reindexação incremental | Manter o índice atualizado sem downtime | Ciclo de atualização de material estabelecido |

### Analytics

**Situação atual:** POST /interacoes registra interação ao final de cada turno (fire-and-forget).

| Evolução | Benefício | Gatilho |
|----------|-----------|---------|
| Dashboard de roteamento | Visualizar distribuição de matérias, taxa de `sem_rota` e `sem_resposta` | Primeiro ciclo de uso com alunos reais |
| Alertas de qualidade | Notificar quando taxa de `sem_resposta` por matéria ultrapassa limiar | Volume suficiente para análise estatística (> 100 interações/matéria) |
| Feedback do aluno | Coletar confirmação de utilidade da resposta ao final do turno | Decisão de produto sobre coleta de feedback explícito |

---

## Resumo comparativo

| Evolução | Benefício | Custo/Complexidade | Gatilho |
|----------|-----------|--------------------|---------|
| STT/TTS externo | Maior precisão e naturalidade | Médio | Taxa de erro STT > 15% |
| Gravação com consentimento | Auditoria e melhoria de modelo | Alto + risco LGPD | Aprovação DPO + decisão de produto |
| `<Play>` com vozes customizadas | Identidade sonora consistente | Baixo-médio | Decisão de branding |
| 0800 | Eliminar custo do aluno | Alto | > 10k min/mês + evidência de barreira |
| Redis para sessões | Escalabilidade horizontal | Baixo | Mais de 1 instância em produção |
| Observabilidade (OpenTelemetry) | Diagnóstico de latência | Baixo | P95 > 3s por 1 semana |
| Autenticação do aluno | Controle de acesso e personalização | Médio | Requisito institucional ou histórico individual |
| RAG com material indexado | Respostas baseadas no conteúdo real | Alto (depende de pipeline) | Material didático disponível |
| Analytics avançado | Visibilidade pedagógica | Baixo-médio | Primeiro ciclo com alunos reais |
