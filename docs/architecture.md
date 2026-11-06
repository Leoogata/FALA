# Arquitetura do agente único

O FALA usa um único deployment de prompt template no watsonx.ai. O backend seleciona a configuração por código da escola; não existe chamada a um classificador ou orquestrador.

## Configurações

- **Padrão:** configuração da plataforma, sem registro de campanha, sem documentos e sem consulta RAG. Atende às matérias do ensino fundamental com conhecimento geral.
- **Escolar:** registro em `Campanha`, com `escolaId`, `descricao` (instruções), `usaRag=true` e materiais próprios. Pode haver vários rascunhos, com somente um agente ativo por escola.
- Ativar um agente exige ao menos um documento `PRONTO` e desativa o anterior dentro de uma transação. Uma constraint parcial também impede duas publicações simultâneas.
- `slug` é apenas um rótulo opcional. Não participa da seleção do agente ou da pesquisa dos materiais.

## Ligação

1. `/voice/incoming` solicita o código DTMF opcional.
2. `/voice/escola` resolve o código e cria/recupera a conversa pela chave HMAC. Código inexistente é informado antes de seguir no geral; erro de serviço não muda silenciosamente a escola.
3. `Conversa` persiste `escolaId`, `agenteId` e uma cópia das instruções. Recuperação após restart mantém esses vínculos; publicar outro agente afeta apenas novas conversas.
4. `/voice/turn` valida e sanitiza a fala e reserva o turno, preservando a idempotência existente.
5. O handler chama `POST /internal/respostas` com `conversa_id` e `turno_token`. Não envia IDs de escola, matéria ou instruções escolhidos pelo cliente.
6. O backend valida a conversa e o turno, recupera pergunta e histórico do banco e chama o serviço compartilhado `gerarResposta`.
7. No modo escolar, pesquisa os materiais; no padrão, pula a pesquisa. Depois chama o mesmo deployment IBM.
8. O resultado é validado/sanitizado. A telefonia confirma a finalização no banco antes de devolver áudio, com TTS e fallback Polly.

As colunas legadas de matéria, confiança do orquestrador e status `SEM_ROTA` ficam no banco para preservar registros históricos. O novo fluxo não as utiliza para decidir respostas.

## RAG

- TXT/PDF → extração/OCR → trechos → embeddings IBM → `documento_trechos` no PostgreSQL/pgvector.
- Modelo inicial: `ibm/granite-embedding-278m-multilingual`, 768 dimensões.
- Cada trecho guarda documento, agente, escola, ordem, texto e modelo do embedding.
- Busca exata por distância cosseno, restrita por escola, agente, modelo e documentos `PRONTO`. O limite `RAG_MIN_SCORE` é configurável e deve ser calibrado com perguntas reais.
- As fontes retornadas são os trechos fornecidos ao modelo; não constituem verificação automática de cada afirmação da resposta.
- Sem evidência: `sem_resposta=true`, sem geração com conhecimento geral. Falha de busca: erro de serviço, sem fallback silencioso para o agente padrão.
- Indexação é idempotente por documento/ordem e protegida por transação. Remoção de documentos elimina os trechos. Trabalhos `PROCESSANDO` são reenfileirados na inicialização após restart.
- `WATSONX_MOCK=true` simula apenas o índice RAG em memória para desenvolvimento/testes. A geração do agente continua usando a IBM. Em uso real, configurar `false`.

## Painel e isolamento

O painel exige uma chave administrativa por escola, provisionada em `SCHOOL_API_TOKENS` no backend. O código público de telefone não é senha. Cada chave identifica exatamente uma escola.

Todos os endpoints de agentes, documentos, testes, instruções e analytics exigem autenticação. O acesso por ID valida a propriedade antes de ler, alterar ou receber um upload. Criação/listagem obtêm a escola do contexto autenticado, ignorando tentativas de escolher outra escola no corpo ou na URL. Os analytics usam ID real, sem agregação por slug compartilhado.

O painel mantém a chave somente na sessão da aba, permite sair e envia o Bearer também nos uploads. Para contas individuais e papéis de usuários, substituir essa autenticação por um provedor de identidade com associação usuário/escola; a separação de dados já está no backend.

A aba Testar usa o mesmo serviço `gerarResposta` da telefonia, inclusive RAG, instruções, política de evidência e histórico. Rascunhos podem ser testados antes da publicação. O teste não salva conversas de alunos.

## Operação e validação

Veja [a migração e configuração](nova-arquitetura-implantacao.md). As alterações do repositório não aplicam migrations nem reiniciam serviços remotos automaticamente.
