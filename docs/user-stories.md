# User Stories — Projeto Ponte (perspectiva dev)

**Stack:** IBM watsonx (Bob) · RAG · Telefonia VoIP/URA · Frontend web · Dados públicos educacionais

---

## Épico 1: Pipeline de dados e score de regiões *(stretch)*

---

### US-01 — Coleta e normalização dos datasets públicos *(stretch)*

**Camada:** Backend / scripts de dados  
**Goal:** ter um dataset limpo e estruturado por município que sirva de input para o agente de score. Sem isso, o US-02 não tem o que processar.

**Como** dev do time Ponte,  
**quero** escrever scripts que coletam e normalizam os datasets públicos de IDEB, censo escolar e cobertura de telefonia,  
**para que** tenhamos um arquivo estruturado por município, pronto para ser enviado ao agente de scoring.

**O que entra:**
- Scripts de coleta (Python ou similar) que baixam os dados das fontes públicas
- Etapa de normalização: padronizar nomes de colunas, tratar nulos, garantir um registro por município
- Arquivo de saída: CSV ou JSON com código IBGE, nome, UF, IDEB, renda per capita, % cobertura de rede
- Arquivo `fontes.md` documentando cada fonte com o link e confirmação de uso comercial permitido

**O que não entra:**
- Nenhuma UI — isso é script puro
- Nenhuma lógica de score — só dados brutos normalizados
- Nenhum dado pessoal ou de clientes

**Critérios de aceite:**
- Script roda do zero e produz o arquivo de saída sem erros
- Todos os municípios têm os campos mínimos preenchidos ou com valor nulo explícito (sem linha faltando)
- `fontes.md` existe e lista todas as origens com URL e licença confirmada

---

### US-02 — Configuração do agente de score no watsonx *(stretch)*

**Camada:** IBM watsonx — configuração do agente  
**Goal:** ter um agente no watsonx capaz de receber os dados de um município e retornar score + explicação. É a inteligência do dashboard — sem ele, US-03 não tem dado para exibir.

**Como** dev do time Ponte,  
**quero** configurar e testar um agente no IBM watsonx que receba os campos de um município e retorne score de sensibilidade, nível e justificativa,  
**para que** o batch de scoring (US-03-batch) e o dashboard consumam essa saída sem implementar lógica de negócio no front.

**O que entra:**
- Criação do agente no watsonx com prompt estruturado (system prompt + schema de input/output)
- Definição dos pesos das variáveis como parâmetros configuráveis no prompt (sem hardcode)
- Testes manuais do agente com amostras do dataset do US-01
- Documentação do schema de resposta: `{ score: 0–100, nivel: "alta"|"média"|"baixa", fatores: string[3] }`

**O que não entra:**
- Processamento em batch — isso fica no US-03-back
- Nenhuma UI
- Integração com banco de dados

**Critérios de aceite:**
- Agente retorna resposta válida no schema definido para qualquer município do dataset
- Alterar os pesos no prompt muda o score sem redeployar o agente
- Agente documentado com exemplos de input/output

---

### US-03-back — Job de batch: rodar scoring e persistir resultados *(stretch)*

**Camada:** Backend  
**Goal:** processar o dataset completo pelo agente do US-02 e salvar os scores no banco, para que o front possa consultá-los sem chamar o watsonx a cada request.

**Como** dev do time Ponte,  
**quero** implementar um job que percorre o dataset do US-01, chama o agente do US-02 para cada município e persiste os resultados no banco,  
**para que** o dashboard acesse scores pré-calculados via API, sem latência de inferência em tempo real.

**O que entra:**
- Job (script ou cron) que itera sobre os municípios e chama o agente watsonx do US-02
- Persistência dos resultados no banco: código IBGE, score, nível, fatores, timestamp da última atualização
- Endpoint `GET /municipios` que retorna os scores salvos com filtros (UF, nível)

**O que não entra:**
- Nenhuma UI
- Lógica de scoring — o agente do US-02 faz isso

**Critérios de aceite:**
- Job processa o dataset completo e persiste todos os registros sem falhas
- `GET /municipios` retorna os dados com filtro por UF e por nível funcionando
- Re-rodar o job atualiza os scores sem duplicar registros

---

### US-03-front — Tela do dashboard com mapa de sensibilidade *(stretch)*

**Camada:** Frontend  
**Goal:** dar uma interface visual para os dados de score, consumindo a API do US-03-back. É a entrega visível do Épico 1 para a demo.

**Como** dev do time Ponte,  
**quero** construir a tela do mapa que exibe os municípios coloridos por nível de sensibilidade,  
**para que** a visualização de regiões prioritárias esteja pronta para a demonstração.

**O que entra:**
- Mapa interativo com municípios coloridos por nível (alta/média/baixa), consumindo `GET /municipios`
- Filtros: por UF, por faixa de score, por cobertura de rede
- Clique no município abre painel lateral com os 3 fatores que geraram o score

**O que não entra:**
- Nenhuma lógica de backend
- Autenticação ou controle de acesso

**Critérios de aceite:**
- Mapa carrega e renderiza todos os municípios sem erro
- Filtros funcionam e atualizam o mapa em tempo real
- Painel lateral exibe os fatores corretamente para qualquer município clicado

---

## Épico 2: Campanhas — Backend

---

### US-04 — Modelagem e API CRUD de campanhas

**Camada:** Backend  
**Goal:** ter a API que o front e o pipeline de RAG vão consumir. É a fundação do Épico 2 — todas as outras US de campanha dependem dela.

**Como** dev do time Ponte,  
**quero** implementar os endpoints de CRUD de campanhas e de upload/remoção de documentos,  
**para que** o front de gestão e o pipeline de RAG tenham uma API estável para trabalhar.

**O que entra:**
- Modelagem do banco: tabela `campanhas` (id, nome, status, created_at) e tabela `documentos` (id, campanha_id, nome, caminho, status_indexacao)
- Endpoints: `POST /campanhas`, `GET /campanhas`, `PATCH /campanhas/:id` (inclui ativar/desativar), `DELETE /campanhas/:id`
- Endpoints de documento: `POST /campanhas/:id/documentos` (upload do arquivo), `DELETE /campanhas/:id/documentos/:docId`
- Validação: aceita apenas PDF e TXT; tamanho máximo configurável

**O que não entra:**
- Nenhuma lógica de RAG ou indexação — isso é o US-05
- Nenhuma UI

**Critérios de aceite:**
- Todos os endpoints respondem corretamente para os casos feliz e de erro (404, 422)
- Desativar campanha seta `status = inativa` e impede invocação via telefonia
- Arquivo de documento é salvo no storage e o caminho persistido no banco

---

### US-05 — Pipeline de indexação RAG por campanha no watsonx

**Camada:** IBM watsonx + Backend (worker/fila)  
**Goal:** transformar os documentos de uma campanha em um índice RAG isolado no watsonx, para que o agente de voz consiga fazer retrieval apenas do conteúdo daquela campanha.

**Como** dev do time Ponte,  
**quero** implementar o pipeline que pega um documento recém-uploadado, faz chunking, gera embeddings e indexa no watsonx associado à campanha,  
**para que** o agente daquela campanha responda apenas com base no conteúdo correto.

**O que entra:**
- Trigger: upload no US-04 enfileira o documento para o pipeline
- Chunking do documento (PDF/TXT) em trechos com tamanho e overlap configuráveis
- Geração de embeddings e indexação no watsonx com metadado `campanha_id` em cada chunk
- Atualização do campo `status_indexacao` no banco: `processando` → `pronto` | `erro`
- Remoção de documento: deleta os chunks daquele documento do índice, sem afetar chunks de outros documentos da mesma campanha

**O que não entra:**
- Nenhuma UI
- Lógica de resposta do agente — isso é o US-08-agent

**Critérios de aceite:**
- Upload de documento dispara o pipeline e o status atualiza até `pronto` ou `erro`
- Busca no índice de uma campanha não retorna chunks de outra campanha
- Remover documento remove exatamente seus chunks do índice (sem sobrar lixo)

---

## Épico 3: Campanhas — Frontend

---

### US-06 — Interface de gestão de campanhas

**Camada:** Frontend  
**Goal:** tornar o fluxo de criar campanha, subir documentos e acompanhar indexação demonstrável sem tocar na API diretamente.

**Como** dev do time Ponte,  
**quero** construir a tela de gestão de campanhas com criação, upload de documentos e controle de status,  
**para que** o fluxo completo de configuração do agente seja demonstrável na apresentação.

**O que entra:**
- Lista de campanhas com nome, status (ativa/inativa) e botão de toggle
- Formulário de criação de campanha
- Upload de documentos via drag and drop, consumindo `POST /campanhas/:id/documentos` do US-04
- Indicador de status de indexação por documento (`processando` / `pronto` / `erro`), atualizado por polling ou websocket
- Remoção de documento com confirmação

**O que não entra:**
- Nenhuma lógica de backend ou de RAG
- Autenticação ou controle de acesso por perfil

**Critérios de aceite:**
- Criar campanha e fazer upload de documento funciona de ponta a ponta na demo
- Status de indexação atualiza na tela sem recarregar a página
- Ativar/desativar campanha reflete imediatamente na API

---

## Épico 4: Telefonia

---

### US-07 — Configuração do fluxo de chamada e URA no provedor de telefonia

**Camada:** Telefonia (Twilio / Vonage / equivalente)  
**Goal:** ter o número 0800 recebendo chamadas e a URA roteando para a campanha certa antes de qualquer lógica de agente entrar.

**Como** dev do time Ponte,  
**quero** configurar o fluxo de chamada no provedor de telefonia com URA que lista as campanhas ativas e roteia para o handler correto,  
**para que** a ligação chegue ao agente da campanha antes de qualquer lógica de AI ser acionada.

**O que entra:**
- Configuração do número no provedor (Twilio ou equivalente) apontando para o webhook da aplicação
- Lógica da URA: busca campanhas ativas via `GET /campanhas` e apresenta as opções ao aluno por voz
- Roteamento: seleção do aluno determina qual campanha será usada no handler
- Fallback: sem campanha ativa → mensagem de voz configurável e encerra a chamada

**O que não entra:**
- Nenhuma lógica de STT, AI ou TTS — isso é o US-08-handler
- Nenhuma UI de configuração

**Critérios de aceite:**
- Chamada recebida pelo número chega na URA sem erro
- URA apresenta corretamente as campanhas ativas no momento da ligação
- Fallback reproduz mensagem e encerra sem travar a chamada

---

### US-08-agent — Configuração do agente de resposta educacional no watsonx

**Camada:** IBM watsonx — configuração do agente  
**Goal:** ter o agente de resposta educacional configurado no watsonx com RAG, pronto para receber uma pergunta em texto e retornar uma resposta com score de confiança.

**Como** dev do time Ponte,  
**quero** configurar o agente educacional no watsonx com RAG apontando para o índice da campanha,  
**para que** o handler de voz possa invocar esse agente passando apenas a pergunta e o ID da campanha.

**O que entra:**
- Criação do agente no watsonx com system prompt educacional (linguagem acessível, ensino fundamental/médio)
- Configuração do RAG: agente busca no índice da campanha passada como parâmetro
- Comportamento de baixa confiança: quando o agente não encontra resposta adequada, retorna flag `sem_resposta: true` em vez de alucinar
- Testes manuais do agente com perguntas de exemplo de diferentes matérias
- Documentação do contrato de invocação: input `{ pergunta: string, campanha_id: string }` → output `{ resposta: string, confianca: float, sem_resposta: bool }`

**O que não entra:**
- Nenhuma lógica de STT ou TTS — isso é o US-08-handler
- Nenhuma persistência de histórico — isso é o US-09

**Critérios de aceite:**
- Agente retorna resposta coerente para perguntas dentro do conteúdo indexado
- Agente retorna `sem_resposta: true` para perguntas fora do escopo, sem inventar resposta
- Contrato de invocação documentado e testado com amostras reais

---

### US-08-handler — Handler de voz: STT → agente → TTS

**Camada:** Backend  
**Goal:** implementar o servidor que fecha o ciclo de uma chamada: recebe o áudio, transcreve, consulta o agente do US-08-agent, converte a resposta em fala e devolve ao aluno.

**Como** dev do time Ponte,  
**quero** implementar o handler que orquestra STT → chamada ao agente watsonx → TTS em resposta a cada turno da ligação,  
**para que** o ciclo completo de pergunta/resposta funcione dentro de uma chamada de voz comum.

**O que entra:**
- Recebimento do áudio do aluno via webhook do provedor de telefonia
- STT: transcrição do áudio para texto (watsonx Speech ou equivalente)
- Chamada ao agente do US-08-agent com `{ pergunta, campanha_id }`
- TTS: conversão da resposta em áudio e envio de volta ao aluno via provedor
- Tratamento do `sem_resposta: true`: TTS reproduz mensagem de fallback orientando buscar o professor
- Disparo do registro de histórico ao final de cada turno (chama o US-09)

**O que não entra:**
- Nenhuma lógica de AI ou RAG — o agente do US-08-agent faz isso
- Nenhuma persistência direta — delega ao US-09

**Critérios de aceite:**
- Pergunta feita na ligação gera resposta em áudio em tempo aceitável para uma conversa
- `sem_resposta: true` resulta no áudio de fallback correto
- Histórico da interação é registrado ao final de cada turno

---

## Épico 5: Histórico

---

### US-09 — Persistência anônima das interações

**Camada:** Backend  
**Goal:** salvar cada turno de conversa no banco de forma anônima, para que os dados de uso fiquem disponíveis para análise sem nenhum dado pessoal do aluno.

**Como** dev do time Ponte,  
**quero** implementar o endpoint e a modelagem que registram cada interação de ligação de forma anônima,  
**para que** o histórico de uso fique disponível para análise sem armazenar dados pessoais.

**O que entra:**
- Modelagem: tabela `interacoes` (id, campanha_id, pergunta, resposta, score_confianca, sem_resposta, timestamp)
- Endpoint `POST /interacoes` invocado pelo handler do US-08-handler ao final de cada turno
- Validação: rejeitar qualquer payload que contenha número de telefone, nome ou CPF

**O que não entra:**
- Nenhuma UI
- Nenhuma lógica de agregação — isso é o US-10

**Critérios de aceite:**
- Handler do US-08 consegue registrar uma interação via `POST /interacoes`
- Tabela não contém nenhum campo de identificação pessoal
- Payload inválido (com PI) retorna erro 422

---

### US-10 — Endpoints de analytics e tela de métricas

**Camada:** Backend + Frontend  
**Goal:** expor as métricas de uso do agente (dúvidas frequentes, taxa de sem_resposta) para que a demo mostre o ciclo completo de melhoria contínua.

**Como** dev do time Ponte,  
**quero** implementar os endpoints de agregação do histórico e a tela que exibe essas métricas,  
**para que** a demo mostre o ciclo de análise e melhoria do agente com dados reais de uso.

**O que entra:**
- Backend: endpoint `GET /analytics/campanhas/:id` retornando top perguntas, % sem_resposta e volume de chamadas por dia
- Backend: dados sempre agregados — nenhuma query retorna registros individuais
- Frontend: tela de métricas por campanha com lista de top perguntas e indicador de taxa de falha

**O que não entra:**
- Nenhuma lógica de retreino automático
- Dados de regiões/municípios — isso é o Épico 1 (stretch)

**Critérios de aceite:**
- Endpoint retorna métricas corretas para interações registradas pelo US-09
- Tela exibe os dados sem expor registros individuais
- Funciona na demo com dados reais ou de seed

---

## Resumo

| ID | Épico | Camada | O que é construído |
|----|-------|--------|--------------------|
| US-01 *(stretch)* | Pipeline de dados | Backend / scripts | Coleta e normalização dos datasets públicos |
| US-02 *(stretch)* | Pipeline de dados | IBM watsonx | Configuração do agente de score por município |
| US-03-back *(stretch)* | Pipeline de dados | Backend | Job de batch + endpoint `GET /municipios` |
| US-03-front *(stretch)* | Pipeline de dados | Frontend | Tela do mapa com scores e filtros |
| US-04 | Campanhas — Backend | Backend | API CRUD de campanhas e documentos |
| US-05 | Campanhas — Backend | IBM watsonx + Backend | Pipeline de indexação RAG por campanha |
| US-06 | Campanhas — Frontend | Frontend | Interface de gestão de campanhas |
| US-07 | Telefonia | Telefonia (Twilio/etc.) | URA e roteamento de chamada para campanha |
| US-08-agent | Telefonia | IBM watsonx | Configuração do agente educacional com RAG |
| US-08-handler | Telefonia | Backend | Handler STT → agente → TTS |
| US-09 | Histórico | Backend | Persistência anônima das interações |
| US-10 | Histórico | Backend + Frontend | Endpoints de analytics + tela de métricas |

---

## Plano de 3 semanas — 3 pessoas

### Semana 1 — Fundação + spike de risco

**Dia 1 (todos juntos):** spike de telefonia — Twilio recebendo chamada, STT → texto → TTS com resposta hardcoded. Sem watsonx ainda. Só para confirmar que a latência é aceitável antes de qualquer outra coisa.

**Pessoa A (Backend):** US-04 + US-05  
**Pessoa B (Telefonia):** US-07 + US-08-agent  
**Pessoa C (Frontend):** US-06

**Meta da semana:** criar campanha, subir documento, indexar e receber resposta do agente via texto. Fluxo de voz ainda desconectado do watsonx.

---

### Semana 2 — Integração ponta a ponta

Com o RAG funcionando, conectar o handler de voz ao agente real. Fechar o ciclo completo: ligação → campanha → pergunta → resposta em áudio → histórico registrado.

**Pessoa A (Backend):** US-09 + US-10  
**Pessoa B (Telefonia):** US-08-handler  
**Pessoa C (Frontend):** US-10 front + ajuda onde travar

**Meta da semana:** fluxo completo funcionando de ponta a ponta. Ligar → escolher campanha → perguntar → receber resposta em áudio → interação registrada no banco.

---

### Semana 3 — Polimento + stretch + demo

MVP rodando. Decidir se atacam o Épico 1 (stretch) ou investem o tempo em deixar a demo sólida. Não começar o stretch antes do fluxo de voz estar estável.

**Pessoa A (se tiver tempo):** US-01 + US-02 + US-03-back *(stretch)*  
**Pessoa C (se tiver tempo):** US-03-front *(stretch)*  
**Todos:** demo, vídeo de 3 minutos, documentação

> **Prioridade:** demo sólida e vídeo > stretch. Um MVP que funciona ao vivo vale mais do que um dashboard bonito com o ciclo de voz quebrando.
