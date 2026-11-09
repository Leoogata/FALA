# Ponte — Painel da Escola

> Atualização: arquitetura de agente único implementada. Consulte o [guia de implantação](../docs/nova-arquitetura-implantacao.md) para o fluxo, as variáveis e as migrations atuais. Menções abaixo ao orquestrador ou ao RAG simulado descrevem o fluxo anterior.

Interface web para que a equipe escolar crie agentes de IA, envie materiais e controle quais agentes atendem os alunos por telefone.

## Stack

React 18 · TypeScript · Vite · React Router v6 · TanStack Query v5 · Tailwind CSS · Lucide React

## Setup

### Forma recomendada — iniciar tudo junto

Para subir backend, telephony-handler e painel de uma vez, use o script na raiz do repositório:

```sh
./iniciar.sh
```

O script inicia os três serviços com as variáveis corretas. Não é preciso criar um `.env` manual para o frontend. Consulte o [guia de início rápido](../README.md#por-onde-começar) para os passos de configuração.

### Execução isolada (somente painel)

```bash
# dentro de frontend/
npm install
```

### Variáveis de ambiente

Copie o arquivo de exemplo e ajuste:

```bash
cp .env.example .env.local
```

| Variável | Configuração local | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | URL da API local; configurar explicitamente |
| `VITE_USE_MOCK` | `false` | `true` para usar dados simulados sem backend |

### Modo mock (demonstração sem backend)

```bash
# Crie .env.local com:
VITE_API_URL=http://localhost:3001
VITE_USE_MOCK=true
```

### Rodar em desenvolvimento

```bash
npm run dev
# Abre em http://localhost:5173
```

### Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

```
src/
  api/          → Camada de API (uma função por rota)
  mock/         → Implementação em memória para modo mock
  components/
    layout/     → Sidebar, AppLayout
    ui/         → Badge, Button, Toggle, Modal, Toast, Skeleton
    agent/      → InstrucoesEditor, MaterialUploadArea, MaterialList
  pages/        → Uma página por rota
  utils/        → date.ts, arquivo.ts
  config.ts     → Constantes globais (escola, limites, textos)
```

## Rotas

| URL | Página |
|---|---|
| `/` | Redireciona para `/agentes` |
| `/agentes` | Lista de agentes |
| `/agentes/novo` | Criação em 4 etapas |
| `/agentes/:id` | Detalhe — aba Materiais |
| `/agentes/:id/instrucoes` | Detalhe — aba Instruções |
| `/agentes/:id/testar` | Detalhe — aba Testar |
| `/agentes/:id/ligacao` | Detalhe — aba Na ligação |

## Mock: dados de exemplo

O modo mock começa com 4 agentes:
- **Matemática 9º ano** — Ativo, 2 materiais prontos
- **História do Acre** — Ativo, 1 processando (vira pronto em 2–4 s), 2 prontos
- **Ciências da horta** — Inativo, 1 pronto + 1 com erro
- **Inglês básico** — Rascunho (sem instruções, sem materiais)


## Integração e limites atuais

O cliente ainda tem fallback para porta 8000 quando `VITE_API_URL` não é definida; configure-a para 3001 no ambiente local deste projeto. `VITE_USE_MOCK=true` usa somente dados simulados.

As telas de gestão, materiais, instruções, teste e preview da ligação existem. Os endpoints de teste do agente e melhoria de instruções ainda são stubs. Regras de ativação, associação de matéria e validação de uploads precisam de alinhamento entre painel e API. O preview de ligação não comprova configuração de número nem execução real de telefonia.

- [Arquitetura](../docs/architecture.md).
- [Pendências de integração e homologação](../docs/pendencias.md#6-concluir-a-integração-do-painel).
