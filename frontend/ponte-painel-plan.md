# Plano — Ponte: Painel da Escola (POC)

## Visão Geral

Construir o front-end completo do painel web da escola, de acordo com o PRD do Painel da Escola (POC). A aplicação permite que a equipe escolar crie agentes de IA, escreva instruções, envie materiais e controle quais agentes atendem os alunos pelo 0800 — tudo em português do Brasil, sem login.

**Stack:** React 18 + TypeScript, Vite, React Router v6, TanStack Query v5, Tailwind CSS, Lucide React (ícones).  
**Localização:** `frontend/campaigns/` (renomear internamente para "painel" no código, mas manter a pasta conforme o repositório).  
**Modo mock:** ativado via `VITE_USE_MOCK=true`.

---

## Sub-Tarefa 1 — Scaffolding e configuração do projeto

**Status:** `[ ] pending`

### Intent
Criar o projeto Vite + React + TypeScript dentro de `frontend/campaigns/`, instalar dependências, configurar Tailwind, React Router, TanStack Query e as variáveis de ambiente. Definir a estrutura de pastas e o arquivo de constantes globais.

### Expected Outcomes
- `frontend/campaigns/` contém um app Vite funcional (`npm run dev` sobe sem erros).
- `src/config.ts` exporta todas as constantes da seção 6 do PRD.
- Variáveis de ambiente `.env.example` com `VITE_API_URL` e `VITE_USE_MOCK`.
- Tailwind configurado com as variáveis CSS da seção 16 no `index.css`.
- React Router com as 8 rotas mapeadas (seção 7) — telas em branco por enquanto.
- TanStack Query `QueryClient` provisionado na raiz.
- Fonte Inter carregada via Google Fonts.
- Título da aba segue o padrão `<Título da página> · Ponte`.

### Todo List
1. Inicializar projeto com `npm create vite@latest . -- --template react-ts` dentro de `frontend/campaigns/`.
2. Instalar dependências: `react-router-dom`, `@tanstack/react-query`, `lucide-react`, `tailwindcss`, `autoprefixer`, `postcss`.
3. Configurar `tailwind.config.ts` apontando para `./src/**/*.{ts,tsx}`.
4. Adicionar variáveis CSS (seção 16) em `src/index.css`.
5. Criar `src/config.ts` com todas as constantes da seção 6.
6. Criar `src/App.tsx` com `BrowserRouter`, `QueryClientProvider` e todas as rotas da seção 7 (páginas como componentes vazios).
7. Criar `.env.example` com `VITE_API_URL=http://localhost:8000` e `VITE_USE_MOCK=false`.
8. Criar estrutura de pastas: `src/api/`, `src/mock/`, `src/components/`, `src/pages/`, `src/hooks/`, `src/utils/`.

### Relevant Context
- PRD seção 6 (constantes), seção 7 (arquitetura e rotas), seção 16 (variáveis CSS, tipografia).
- Repositório: `frontend/campaigns/`.

---

## Sub-Tarefa 2 — Camada de API e tipos TypeScript

**Status:** `[ ] pending`

### Intent
Criar o módulo `src/api/` com uma função por rota do PRD (9 no total) e todos os tipos TypeScript do contrato. A camada aplica timeouts, converte erros no formato da seção 5.10 e não usa `fetch` direto nos componentes.

### Expected Outcomes
- `src/api/types.ts` com todas as interfaces (`Agente`, `Material`, `DocsCount`, `ErroAPI`, `RespostaMelhorar`, `RespostaTestar`).
- `src/api/client.ts` com a função base de `fetch` que aplica `VITE_API_URL`, timeouts e parse de erro.
- `src/api/agentes.ts` com `listarAgentes`, `criarAgente`, `buscarAgente`, `atualizarAgente`.
- `src/api/materiais.ts` com `listarMateriais`, `enviarMaterial` (com `onProgress`), `removerMaterial`.
- `src/api/instrucoes.ts` com `melhorarInstrucoes`.
- `src/api/testar.ts` com `testarAgente`.
- Todos os erros conhecidos (seção 5.10) lançados como objetos tipados.

### Todo List
1. Criar `src/api/types.ts` com todas as interfaces do contrato da seção 5.
2. Criar `src/api/client.ts`: função `apiFetch` com `AbortController` + timeout, parse de `{ erro, mensagem }`, lançamento de `ApiError`.
3. Criar `src/api/agentes.ts` (rotas 1–4).
4. Criar `src/api/materiais.ts` (rotas 5–7), incluindo upload via `XMLHttpRequest` para progresso real.
5. Criar `src/api/instrucoes.ts` (rota 8, timeout 30 s).
6. Criar `src/api/testar.ts` (rota 9, timeout 30 s).
7. Criar `src/api/index.ts` re-exportando tudo.

### Relevant Context
- PRD seção 5 (contrato completo), seção 5.10 (erros), seção 6 (`TIMEOUT_PADRAO_MS`, `TIMEOUT_IA_MS`).

---

## Sub-Tarefa 3 — Modo mock

**Status:** `[ ] pending`

### Intent
Criar `src/mock/` com uma implementação em memória de todas as 9 rotas, usando os dados da seção 17. O mock simula latência, processamento de materiais, erros de indexação e aplica todas as regras de negócio.

### Expected Outcomes
- `src/mock/data.ts` com os 4 agentes iniciais (datas calculadas em runtime a partir de `Date.now()`).
- `src/mock/handlers.ts` implementando cada função da `src/api/` contra os dados em memória.
- Latência de 300–800 ms em chamadas normais; 1,5 s nas rotas 8 e 9.
- Material enviado muda de `processando` → `pronto` em 2–4 s; se o nome contiver "erro" ou "scan", vai para `erro` com a mensagem correta.
- `chico-mendes-texto-base.pdf` (agente "História do Acre") muda para `pronto` em 2–4 s após carregar.
- Regras R1–R10 aplicadas (toggle travado, `sem_instrucoes`, `arquivo_duplicado`, etc.).
- `src/mock/index.ts` re-exportando os handlers.
- `src/api/client.ts` verifica `import.meta.env.VITE_USE_MOCK` e despacha para o mock ou para `apiFetch`.

### Todo List
1. Criar `src/mock/data.ts` com os 4 agentes, ids gerados com `crypto.randomUUID()`, datas relativas em runtime.
2. Criar `src/mock/handlers.ts` com função por rota, aplicando latência simulada com `setTimeout` + `Promise`.
3. Implementar regras de negócio no mock: nomes duplicados, toggle travado, `sem_instrucoes`, limites de upload, `arquivo_duplicado`.
4. Implementar lógica de mudança de status de material com `setTimeout` pós-upload.
5. Implementar rotas 8 e 9 (mock): rota 8 devolve texto estruturado; rota 9 usa heurística de palavras com 5+ letras.
6. Conectar mock ao `client.ts` via flag `VITE_USE_MOCK`.

### Relevant Context
- PRD seção 7 (modo mock), seção 15 (regras de negócio), seção 17 (dados de exemplo).

---

## Sub-Tarefa 4 — Layout principal e barra lateral

**Status:** `[ ] pending`

### Intent
Implementar o layout de duas colunas (barra lateral + conteúdo), o menu de navegação, o cartão da escola e o comportamento responsivo abaixo de 900 px.

### Expected Outcomes
- `src/components/layout/Sidebar.tsx` com marca, menu e cartão da escola.
- SVG do logo conforme especificado no PRD seção 8.
- Item "Métricas" desabilitado com tooltip "Disponível em uma próxima versão" e badge "em breve".
- Item "Agentes" destacado em qualquer rota `/agentes/*`.
- Abaixo de 900 px: barra vira faixa no topo; sem rolagem horizontal.
- `src/components/layout/AppLayout.tsx` envolvendo o conteúdo com largura máxima de 1140 px.
- Faixa de "sem internet" (`navigator.onLine`) fixa no topo do conteúdo.
- Título da aba do navegador atualizado em cada página via hook.

### Todo List
1. Criar `src/components/layout/Sidebar.tsx` com as três seções (marca, menu, cartão).
2. Criar o SVG do logo inline conforme o PRD.
3. Implementar item "Métricas" desabilitado com tooltip e badge.
4. Implementar destaque de rota ativa com `useLocation`.
5. Criar `src/components/layout/AppLayout.tsx` com as duas colunas e a faixa "sem internet".
6. Adicionar media query `@media (max-width: 900px)` para layout responsivo.
7. Criar `src/hooks/usePageTitle.ts` para atualizar `document.title`.

### Relevant Context
- PRD seção 8 (layout), seção 6 (`ESCOLA`, `TELEFONE_0800`), seção 16 (cores CSS, `--navy`).

---

## Sub-Tarefa 5 — Componentes compartilhados

**Status:** `[ ] pending`

### Intent
Construir os componentes reutilizáveis que aparecem em múltiplas telas: selos (badges), toggle ativo/inativo, toasts, modais genéricos, esqueletos de carregamento e formatação de datas e tamanhos.

### Expected Outcomes
- `src/utils/date.ts`: `tempoRelativo(iso, agora)` e `formatarData(iso)` (tooltip com America/Sao_Paulo).
- `src/utils/arquivo.ts`: `formatarTamanho(bytes)` com vírgula decimal, e `pluralizar(n, singular, plural)`.
- `src/components/ui/Badge.tsx`: selos Ativo, Inativo, Rascunho, Pronto, Processando, Enviando, Erro — com texto e cor.
- `src/components/ui/Toggle.tsx`: `<input type="checkbox" role="switch">`, 38×22 px, lógica de travado.
- `src/components/ui/Toast.tsx` e `src/hooks/useToast.ts`: fila de toasts, posição inferior-central, `aria-live="polite"`, duração 4,5 s / 7 s.
- `src/components/ui/Modal.tsx`: `role="dialog"` / `alertdialog`, fundo escuro, foco preso, Esc fecha.
- `src/components/ui/Skeleton.tsx`: retângulos cinza animados.
- `src/components/ui/Button.tsx`: variantes principal, secundário, destrutivo, IA, fantasma; desabilitado com 45% opacidade.

### Todo List
1. Criar `src/utils/date.ts` com `tempoRelativo` e tooltip em pt-BR / America/Sao_Paulo.
2. Criar `src/utils/arquivo.ts` com `formatarTamanho` e `pluralizar`.
3. Criar `src/components/ui/Badge.tsx` com todas as variantes de status.
4. Criar `src/components/ui/Toggle.tsx` com lógica de travado, `aria-label` e sem clique otimista.
5. Criar `src/hooks/useToast.ts` e `src/components/ui/ToastRegion.tsx`.
6. Criar `src/components/ui/Modal.tsx` com trap de foco e Esc.
7. Criar `src/components/ui/Skeleton.tsx`.
8. Criar `src/components/ui/Button.tsx` com as 5 variantes.

### Relevant Context
- PRD seção 3 (status do agente, formato de data, tamanho), seção 14 (toggle, modal, toasts, selos), seção 16 (cores, tipografia).

---

## Sub-Tarefa 6 — Lista de agentes (`/agentes`)

**Status:** `[ ] pending`

### Intent
Implementar a página de lista de agentes com resumo, filtros segmentados, busca, tabela/cartões e polling automático.

### Expected Outcomes
- `src/pages/AgentesPage.tsx` busca dados via TanStack Query (rota 1).
- Polling a cada 5 s enquanto `docs.processando > 0`; pausa quando aba oculta.
- Três cartões de resumo calculados no front.
- Seletor segmentado (Todos/Ativos/Inativos/Rascunhos) com contagem.
- Campo de busca filtrando por nome sem diferenciar maiúsculas nem acentos.
- Parâmetro `?status=` na URL persistido.
- Tabela com colunas: Agente, Materiais, Atualizado, Status, seta "›".
- Clicar na linha (exceto toggle) abre `/agentes/:id`. Enter na linha também abre.
- Piscada amarela de 2 s na linha de um agente recém-criado (via state de navegação).
- Estados: esqueleto (4 linhas), vazio, sem resultado de filtro, erro de rede.
- Abaixo de 900 px: linhas viram cartões empilhados.
- Toast de erro quando material muda para `erro` durante o polling.

### Todo List
1. Criar `src/pages/AgentesPage.tsx` com `useQuery` para rota 1.
2. Implementar polling condicional com `refetchInterval` do TanStack Query, pausando com `document.visibilitychange`.
3. Implementar os 3 cartões de resumo com plural correto.
4. Implementar seletor segmentado e busca, com estado lido/escrito na URL via `useSearchParams`.
5. Implementar a tabela com todas as colunas e a lógica de navegação por clique e Enter.
6. Implementar highlight de linha piscando (via `state` do React Router `navigate`).
7. Implementar toast de erro quando polling detecta material que mudou para `erro`.
8. Implementar todos os estados da tela (esqueleto, vazio, sem resultado, erro).
9. Aplicar responsividade: cartões abaixo de 900 px.

### Relevant Context
- PRD seção 9 (lista), seção 3 (status do agente), seção 7 (polling), seção 14 (toasts, toggle).

---

## Sub-Tarefa 7 — Fluxo de criação em 4 etapas (`/agentes/novo`)

**Status:** `[ ] pending`

### Intent
Implementar o wizard de criação de agente com 4 etapas: Identificação, Instruções, Materiais e Revisão. O agente é criado no backend ao sair da etapa 1 e pode ser salvo como rascunho se o usuário sair antes.

### Expected Outcomes
- `src/pages/NovoAgentePage.tsx` com indicador de etapas, rodapé fixo e gestão do `agentId` em estado local.
- Etapa 1: campo nome, botão "Ouvir" com `speechSynthesis`, validação (vazio, < 3 chars, nome duplicado), chamada rota 2 ou 4.
- Etapa 2: editor de instruções reutilizado do sub-tarefa 9, validação 20–4000 chars, chamada rota 4.
- Etapa 3: bloco de upload reutilizado do sub-tarefa 8, com polling e botão "Pular por enquanto" / "Continuar".
- Etapa 4: revisão com links "editar", checkbox "Ativar agora" com lógica de desabilitado, chamada rota 4 com `{ ativa: true }` se marcado, navegação para `/agentes` com toast e piscada.
- Modal de confirmação ao tentar sair com texto não salvo.
- Subtítulo muda após etapa 1 ser concluída ("Rascunho salvo.").

### Todo List
1. Criar `src/pages/NovoAgentePage.tsx` com estado de etapa atual e `agentId`.
2. Implementar indicador de etapas com pílulas, status concluído/atual/futuro.
3. Implementar rodapé fixo com lógica "Cancelar" / "Sair e continuar depois" / "Voltar" / "Continuar" / "Concluir".
4. Implementar Etapa 1 com validação, chamadas rota 2/4 e botão "Ouvir".
5. Implementar Etapa 2 reutilizando o componente de editor de instruções.
6. Implementar Etapa 3 reutilizando o componente de upload/materiais.
7. Implementar Etapa 4 com revisão, checkbox "Ativar agora" e lógica de aviso de materiais.
8. Implementar modal de saída com alterações não salvas.
9. Implementar navegação pós-conclusão com toast correto e flag de piscada.

### Relevant Context
- PRD seção 10 (etapas 1–4 detalhadas), seção 6 (validações: `NOME_MIN`, `NOME_MAX`, `INSTRUCOES_MIN`, `INSTRUCOES_MAX`).

---

## Sub-Tarefa 8 — Detalhe do agente e aba Materiais (`/agentes/:id`)

**Status:** `[ ] pending`

### Intent
Implementar a página de detalhe com o cabeçalho compartilhado (título, renomear, toggle, faixas de aviso) e a aba Materiais (área de upload, lista com polling, remoção).

### Expected Outcomes
- `src/pages/DetalheAgentePage.tsx` busca dados via rota 3, com estado 404 tratado.
- Cabeçalho com botão "Renomear" (modal com validação e rota 4), toggle, selo de status e faixas de aviso (rascunho / sem instruções).
- 4 abas que mudam a URL; a aba Materiais tem badge "!" quando `docs.erro > 0`.
- Aba Materiais:
  - Área de upload com drag-and-drop, seletor de arquivos, validação client-side.
  - Aviso fixo sobre dados pessoais.
  - Upload paralelo (máx. 3) com progresso real via XHR.
  - Lista de materiais com etiqueta PDF/TXT, nome, tamanho, tempo relativo, barra de progresso animada (processando), mensagem de erro, selo e botão lixeira.
  - Polling rota 6 a cada 3 s enquanto houver `processando`; pausa quando aba oculta.
  - Toast de erro quando material muda para `erro`.
  - Modal de remoção com lógica de desativação de agente (PRD seção 14).
- Estado 404: "Agente não encontrado" + botão "Voltar".

### Todo List
1. Criar `src/pages/DetalheAgentePage.tsx` com `useQuery` rota 3 e tratamento 404.
2. Implementar cabeçalho compartilhado reutilizável (`src/components/agent/AgentHeader.tsx`).
3. Implementar modal "Renomear" com validação e rota 4.
4. Implementar tabs com `role="tablist"` e URLs distintas.
5. Criar `src/components/agent/MaterialUploadArea.tsx` com drag-and-drop, validação e XHR com progresso.
6. Criar `src/components/agent/MaterialList.tsx` com lista, polling e toast de erro.
7. Implementar polling condicional para rota 6.
8. Criar `src/components/agent/RemoverMaterialModal.tsx` com lógica de aviso de desativação.
9. Implementar todos os estados (esqueleto, vazio, erro de rede).

### Relevant Context
- PRD seção 11 (detalhe + aba Materiais), seção 14 (modal de remoção, toggle), seção 6 (`UPLOAD_PARALELOS`, `POLLING_DOCUMENTOS_MS`).

---

## Sub-Tarefa 9 — Aba Instruções e "Melhorar com IA" (`/agentes/:id/instrucoes`)

**Status:** `[ ] pending`

### Intent
Implementar o editor de instruções como componente reutilizável (usado também na etapa 2 da criação) e o fluxo completo do "Melhorar com IA" com painel de comparação.

### Expected Outcomes
- `src/components/agent/InstrucoesEditor.tsx`: textarea, contador, "Melhorar com IA", "Voltar ao meu texto", bloco de regras fixas recolhível.
- Fluxo de "Melhorar com IA": loading, painel com comparação lado a lado, listas de mudanças/premissas, botões "Usar sugestão", "Usar e editar", "Descartar".
- "Voltar ao meu texto" restaura texto anterior guardado em memória.
- Aba Instruções (`src/pages/AbaInstrucoesPage.tsx`): título, texto de aviso, editor, botões "Descartar alterações" / "Salvar instruções".
- Modal de saída sem salvar (ao trocar de aba ou sair da página via `beforeunload`).
- Toasts corretos conforme contexto (etapa 2 vs. aba Instruções).

### Todo List
1. Criar `src/components/agent/InstrucoesEditor.tsx` com textarea, contador 0–4000, validação.
2. Implementar botão "Melhorar com IA" com estado loading e chamada rota 8.
3. Implementar painel de comparação (duas colunas) com mudanças, premissas e três botões de ação.
4. Implementar lógica "Voltar ao meu texto" via ref/state.
5. Criar bloco "Regras fixas da Ponte" recolhível com `REGRAS_FIXAS`.
6. Criar `src/pages/AbaInstrucoesPage.tsx` com rodapé de ação e guards de saída.
7. Implementar modal "Sair sem salvar?" e `beforeunload`.

### Relevant Context
- PRD seção 12 (editor + "Melhorar com IA"), seção 6 (`REGRAS_FIXAS`, `INSTRUCOES_MIN`, `INSTRUCOES_MAX`, `TIMEOUT_IA_MS`).

---

## Sub-Tarefa 10 — Aba Testar (`/agentes/:id/testar`)

**Status:** `[ ] pending`

### Intent
Implementar a interface de chat de texto para testar o agente, com balões, sugestões, `speechSynthesis` e confiança/sem resposta.

### Expected Outcomes
- `src/pages/AbaTestarPage.tsx` com área de conversa, campo de texto e botão "Enviar".
- Balões: pergunta (direita, azul-marinho), aguardando (três pontos animados), resposta (esquerda, branco), erro (cinza).
- Confiança exibida como "confiança 84%" (arredondado); `sem_resposta` mostra borda/badge laranja.
- Duas sugestões clicáveis.
- Botão "Limpar conversa" quando há mensagens.
- "Ouvir" com `speechSynthesis` em pt-BR.
- Aviso amarelo quando `docs.pronto === 0`.
- Rolar conversa ao fim a cada nova mensagem.
- Estado da conversa em memória por agente (se perde ao recarregar).

### Todo List
1. Criar `src/pages/AbaTestarPage.tsx` com estado de mensagens e lógica de envio (rota 9).
2. Implementar componentes de balão: `PerguntaBubble`, `AguardandoBubble`, `RespostaBubble`, `ErroBubble`.
3. Implementar scroll automático com `useRef` + `scrollIntoView`.
4. Implementar sugestões clicáveis.
5. Implementar botão "Ouvir" com `speechSynthesis`.
6. Implementar botão "Limpar conversa".
7. Implementar aviso "Sem material pronto".

### Relevant Context
- PRD seção 13 (aba Testar), seção 6 (`TIMEOUT_IA_MS`).

---

## Sub-Tarefa 11 — Aba Na ligação (`/agentes/:id/ligacao`)

**Status:** `[ ] pending`

### Intent
Implementar a prévia do menu de voz da ligação, mostrando o roteiro completo com leitura em voz alta por `speechSynthesis`.

### Expected Outcomes
- `src/pages/AbaLigacaoPage.tsx` busca agentes ativos (rota 1 com `?ativa=true`).
- Lista de preview montada: agentes ativos + agente atual (se inativo).
- Texto `{lista}` montado com vírgula e "ou" antes do último.
- Roteiro com três falas: saudação+menu, aluno, escolha.
- Botão "Ouvir tudo" lê as falas da Ponte em sequência.
- Botão de alto-falante por fala individual.
- Faixas de cor diferente para PONTE e ALUNO.
- Aviso amarelo se agente estiver inativo.
- Edge case: lista vazia → só saudação + `semAgentes`.

### Todo List
1. Criar `src/pages/AbaLigacaoPage.tsx` com `useQuery` para rota 1 filtrada.
2. Implementar montagem da lista de preview e texto `{lista}`.
3. Renderizar roteiro com falas coloridas e rótulos "PONTE" / "ALUNO".
4. Implementar "Ouvir tudo" e botões por fala com `speechSynthesis`.
5. Implementar aviso de agente inativo.
6. Tratar edge case de lista vazia.

### Relevant Context
- PRD seção 13 (aba Na ligação), seção 6 (`TEXTOS_LIGACAO`, `TELEFONE_0800`).

---

## Sub-Tarefa 12 — Páginas de erro e polimento final

**Status:** `[ ] pending`

### Intent
Implementar as telas de erro genérico (404 de rota e agente não encontrado), validar acessibilidade, responsividade e todos os critérios de aceite da seção 18.

### Expected Outcomes
- Página "Página não encontrada" para rotas desconhecidas + botão "Voltar para agentes".
- Tela "Agente não encontrado" para 404 da rota 3.
- Todos os critérios da seção 18 verificados e passando.
- Nenhuma ocorrência de "campanha", ids, caminhos de arquivo ou campos fora da seção 4 visíveis na UI.
- Tudo funciona a 375 px sem rolagem horizontal.
- Navegação completa por teclado: Tab, Enter, Espaço, Esc.
- `role="tablist"`, `aria-selected`, `aria-label` em todos os botões de ícone.
- Contraste ≥ 4,5:1 para todos os textos.

### Todo List
1. Criar `src/pages/NotFoundPage.tsx`.
2. Verificar e corrigir todos os `aria-label` em botões de ícone.
3. Verificar rolagem horizontal a 375 px em todas as páginas.
4. Revisar navegação por teclado em tabelas, modais e toggles.
5. Confirmar que nenhuma palavra "campanha", UUID ou caminho de arquivo aparece na UI.
6. Testar modo mock de ponta a ponta contra todos os critérios da seção 18.
7. Atualizar `frontend/campaigns/README.md` com instruções de setup e modo mock.

### Relevant Context
- PRD seção 18 (critérios de aceite), seção 16 (acessibilidade), seção 7 (rotas 404).

---

## Notas de Implementação

- **Nunca** use a palavra "campanha" em textos visíveis. No código interno, as variáveis podem usar o nome técnico para clareza.
- O estado do servidor fica no cache do TanStack Query. Após mutações nas rotas 2, 4, 5, 7 → invalidar queries de lista (rota 1) e detalhe (rota 3).
- Rotas 8 e 9 **nunca** invalidam cache.
- O polling para quando `visibilityState === 'hidden'` e retoma ao voltar.
- O toggle nunca é otimista: só muda após resposta da API.
- Datas ISO do backend → `tempoRelativo()` no front; tooltip com fuso `America/Sao_Paulo`.
