# watsonx/agent-educational/README-config.md — Configuração no watsonx Studio

## Visão geral

Este documento descreve o passo a passo reproduzível para criar o **prompt-template orquestrador** e os **cinco prompt-templates educacionais** no IBM watsonx Studio. Todos os prompts estão em `system-prompt.md`; o contrato de I/O está em `schema.json`.

---

## Pré-requisitos

- Conta IBM Cloud com acesso ao IBM watsonx.ai
- Projeto criado no watsonx Studio
- `WATSONX_PROJECT_ID` — ID do projeto (disponível em **Manage → General → Details**)
- `WATSONX_API_KEY` — chave de API IBM Cloud (disponível em **Manage → Access → API keys**)
- Modelo de linguagem selecionado: **ibm/granite-13b-instruct-v2** ou equivalente disponível na região

---

## 1. Criar e implantar o orquestrador

1. Acesse o projeto no **watsonx Studio → Prompt Lab** e crie um prompt **Freeform**.
2. Preencha:
   - **Name:** `fala-orchestrator`
   - **Description:** `Classifica a pergunta do aluno e retorna a campanhaId mais adequada entre as campanhas ativas.`
3. Cole o conteúdo da seção "Agente Orquestrador" de `system-prompt.md` e finalize-o com `Agora classifique a entrada:\n{input}\nSaída:`. Salve como template.
4. Teste com a entrada JSON usando a variável `input`.
5. Promova o template para o espaço de implantação e crie uma implantação online.
6. Anote o **Deployment ID** ou o **serving name** (será usado pelo handler como `WATSONX_AGENT_ORCHESTRATOR_ID`). O handler envia `input` em `parameters.prompt_variables`.

O formato esperado da saída é:
   ```json
   {
     "type": "object",
     "required": ["campanhaId", "confianca", "sem_rota"],
     "properties": {
       "campanhaId": { "type": "string", "enum": ["historia", "geografia", "portugues", "matematica", "ciencias"] },
       "confianca": { "type": "number", "minimum": 0, "maximum": 1 },
       "sem_rota": { "type": "boolean" }
     }
   }
   ```

O enum limita os IDs previstos pelo contrato; a campanha escolhida também deve estar na lista de campanhas ativas da entrada. Para perguntas ambíguas ou fora do escopo, o modelo ainda escolhe a matéria mais próxima e sinaliza `sem_rota: true`, para que o handler aplique o fallback. O esquema acima documenta o formato; por si só, não impõe restrições à geração no watsonx.

---

## 2. Criar e implantar os cinco subagentes educacionais

Repita os passos abaixo para cada matéria. O que muda entre os subagentes é apenas o nome, a descrição e o system prompt.

| # | Name | Description | System Prompt (seção em system-prompt.md) |
|---|------|-------------|------------------------------------------|
| 1 | `fala-agent-historia` | Responde dúvidas de História para EF/EM | "Subagente — História" |
| 2 | `fala-agent-geografia` | Responde dúvidas de Geografia para EF/EM | "Subagente — Geografia" |
| 3 | `fala-agent-portugues` | Responde dúvidas de Português para EF/EM | "Subagente — Português" |
| 4 | `fala-agent-matematica` | Responde dúvidas de Matemática para EF/EM | "Subagente — Matemática" |
| 5 | `fala-agent-ciencias` | Responde dúvidas de Ciências para EF/EM | "Subagente — Ciências" |

**Passos por subagente:**

1. Acesse **watsonx Studio → Prompt Lab** e crie um prompt **Freeform**.
2. Preencha **Name** e **Description** conforme a tabela acima.
3. Cole o system prompt da seção correspondente de `system-prompt.md`, finalize-o com `Entrada: {input}\nSaída:` e salve o template.
4. Promova o template para o mesmo espaço de implantação e crie uma implantação online.
5. Anote o **Deployment ID** ou o **serving name** de cada implantação.

O formato esperado da saída é:
   ```json
   {
     "type": "object",
     "required": ["resposta", "confianca", "sem_resposta"],
     "properties": {
       "resposta": { "type": "string" },
       "confianca": { "type": "number" },
       "sem_resposta": { "type": "boolean" }
     }
   }
   ```

---

## 3. Registro de subagentes no handler

Após criar os agentes, adicione ao `.env` do `backend/telephony-handler` as variáveis necessárias:

```env
WATSONX_PROJECT_ID=<id-do-projeto>
WATSONX_API_KEY=<chave-ibm-cloud>
WATSONX_AGENT_ORCHESTRATOR_ID=<deployment-id-ou-serving-name-do-orquestrador>
```

O registro interno que associa cada `campanhaId` ao `agentId` deve ser configurado no `backend/telephony-handler` como variável de ambiente ou arquivo de configuração:

```env
WATSONX_AGENT_ID_HISTORIA=<deployment-id-ou-serving-name-fala-agent-historia>
WATSONX_AGENT_ID_GEOGRAFIA=<deployment-id-ou-serving-name-fala-agent-geografia>
WATSONX_AGENT_ID_PORTUGUES=<deployment-id-ou-serving-name-fala-agent-portugues>
WATSONX_AGENT_ID_MATEMATICA=<deployment-id-ou-serving-name-fala-agent-matematica>
WATSONX_AGENT_ID_CIENCIAS=<deployment-id-ou-serving-name-fala-agent-ciencias>
```

---

## 4. Testar as implantações no Studio (antes de integrar ao handler)

Use os casos de teste em `test-cases/` para validar cada agente manualmente:

1. Para o **orquestrador**: abra a implantação no Studio, informe o JSON na variável `input` e verifique a saída.
2. Para cada **subagente**: envie `{ "campanhaId": "<materia>", "pergunta": "<texto>" }` na variável `input` e confirme que retorna `sem_resposta: true` (enquanto não houver material indexado).

**Critérios de aprovação antes de integrar ao handler:**
- Orquestrador roteia corretamente todos os 5 casos de escopo (`01` a `05`)
- Orquestrador retorna `sem_rota: true` para `06` e `07`
- Todos os subagentes retornam `sem_resposta: true` para qualquer pergunta (fase sem material)

---

## 5. Variáveis de ambiente necessárias para o handler

| Variável | Descrição |
|----------|-----------|
| `WATSONX_PROJECT_ID` | ID do projeto watsonx Studio |
| `WATSONX_API_KEY` | Chave de API IBM Cloud |
| `WATSONX_AGENT_ORCHESTRATOR_ID` | ID da implantação ou serving name do orquestrador |
| `WATSONX_AGENT_ID_HISTORIA` | ID da implantação ou serving name do subagente de História |
| `WATSONX_AGENT_ID_GEOGRAFIA` | ID da implantação ou serving name do subagente de Geografia |
| `WATSONX_AGENT_ID_PORTUGUES` | ID da implantação ou serving name do subagente de Português |
| `WATSONX_AGENT_ID_MATEMATICA` | ID da implantação ou serving name do subagente de Matemática |
| `WATSONX_AGENT_ID_CIENCIAS` | ID da implantação ou serving name do subagente de Ciências |
| `ORCHESTRATOR_CONFIDENCE_THRESHOLD` | Confiança mínima do orquestrador (sugerido: `0.5`) |

---

## 6. Postergado — watsonxClient (RAG)

A implementação real de `indexChunks`, `search` e `deleteDocumentChunks` do `watsonxClient` será feita quando os materiais didáticos estiverem disponíveis. O contrato dessas operações está documentado em `schema.json` (seção `watsonxClient`).

Quando essa fase chegar:
1. Criar o índice vetorial no watsonx Discovery ou equivalente.
2. Implementar `watsonxClient` conforme o contrato de `schema.json`.
3. Documentar em `watsonx/watsonx-client/README.md`.
4. Atualizar os system prompts dos subagentes para incorporar os resultados do RAG.
