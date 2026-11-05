# Ponte — Painel da Escola

Interface web para que a equipe escolar crie agentes de IA, envie materiais e controle quais agentes atendem os alunos pelo 0800.

## Stack

React 18 · TypeScript · Vite · React Router v6 · TanStack Query v5 · Tailwind CSS · Lucide React

## Setup

```bash
# dentro de frontend/
npm install
```

### Variáveis de ambiente

Copie o arquivo de exemplo e ajuste:

```bash
cp .env.example .env.local
```

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base do backend |
| `VITE_USE_MOCK` | `false` | `true` para usar dados simulados sem backend |

### Modo mock (demonstração sem backend)

```bash
# Crie .env.local com:
VITE_API_URL=http://localhost:8000
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
