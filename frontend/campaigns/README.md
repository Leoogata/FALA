# frontend/campaigns — Interface de Gestão de Campanhas

**Responsável pela US-06.**

Tela onde o administrador (escola ou Fundação) cria campanhas, faz upload de materiais didáticos e acompanha a indexação. Consome a API em `backend/api` e observa o status atualizado por `backend/rag-pipeline`.

## O que faz

- Lista campanhas com nome, status (ativa/inativa) e botão de toggle
- Formulário de criação de campanha
- Upload de documentos via drag and drop
- Indicador de status de indexação por documento, atualizado em tempo real (polling ou websocket)
- Remoção de documento com confirmação

## O que precisa estar aqui

- Páginas da tela de gestão
- Componente de drag and drop para upload
- Lógica de polling/websocket para status de indexação
- Chamadas à API do `backend/api`
- Design consistente com o resto do produto (ver `design/`)

## O que NÃO deve estar aqui

- Qualquer lógica de backend
- Autenticação ou controle de acesso por perfil (fora do escopo do MVP)
- Lógica de RAG — o front só mostra o status

## Como fala com os outros módulos

- Consome **backend/api** para CRUD de campanhas e documentos
- Consulta status de indexação exposto pela **backend/rag-pipeline** via API

## Decisões técnicas em aberto

- Framework: React? Next.js? Vue? (checar o que a equipe já domina)
- Biblioteca de componentes: shadcn, Chakra, Mantine, próprio?
- Estratégia de atualização de status: polling simples ou websocket?

## Setup

A ser preenchido quando o framework for escolhido.
