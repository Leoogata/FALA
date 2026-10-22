# watsonx — Configuração dos Agentes IBM Bob

Agrupa a configuração dos agentes de IA do Ponte no IBM watsonx. Esta pasta não contém código de aplicação — tem prompts, schemas, test cases e documentação de como configurar cada agente no watsonx studio.

## Subpastas

- `agent-educational/` — Agente que responde dúvidas dos alunos nas ligações (US-08-agent)
- `agent-score/` — Agente que calcula score de sensibilidade dos municípios (US-02, stretch)

## O que vive aqui

- System prompts dos agentes (`system-prompt.md`)
- Schemas de input/output (`schema.json`)
- Test cases com perguntas/dados de exemplo e comportamento esperado
- Documentação passo a passo de como recriar cada agente no watsonx studio

## O que NÃO vive aqui

- Código de orquestração (fica em `backend/telephony-handler` ou `data-pipeline`)
- Credenciais da conta watsonx (nunca comitar — usar .env no backend)

## Nota sobre o IBM Bob

O IBM Bob é a assistência de dev do IBM watsonx para construção do projeto. Usar o Bob para gerar prompts iniciais, iterar o comportamento e validar os test cases. As decisões finais vão ficar documentadas aqui para que o resto do time possa reproduzir sem precisar do Bob.
