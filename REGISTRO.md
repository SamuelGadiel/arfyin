# REGISTRO.md — log de tudo que foi feito no projeto

> Log cronológico de ações executadas de forma autônoma: o que foi instalado, criado, decidido, alterado. Objetivo: o Samuel conseguir revisar tudo depois sem precisar reconstruir o raciocínio do zero.

## 2026-11-20

- Pesquisa do estado atual do Chrome do usuário e das 4 extensões concorrentes (Session Buddy, TabStack, Tab Group, Tabliss) — documentado em `docs/research/chrome-context.md`, `docs/research/session-buddy-conteudo-completo.md`, `docs/research/tab-group-conteudo-completo.md`.
- Criado `CLAUDE.md` do projeto apontando para a pesquisa.
- Recebidos os 11 pontos de requisitos do usuário (sync, export/import, grupos/abas, abas ao vivo, persistência de sessão, performance/arquitetura, estética cozy, zen mode, interações de aba/grupo, layouts, acesso rápido numerado).
- Criado `feature_ideas.md` — captura completa e organizada de todos os pontos, sem omissão.
- Criado `docs/architecture/decisions.md` (ADR-001 a ADR-009) — decisões autônomas de stack e arquitetura:
  - Chrome Extension MV3 + TypeScript + Vite + `@crxjs/vite-plugin`
  - UI em Svelte 5
  - Service worker como processo central único (requisito de performance do usuário)
  - IndexedDB como cache local
  - Supabase como backend de sync (mesmo padrão já validado pelo concorrente TabStack)
  - Auth via Google OAuth (`chrome.identity`)
  - Estratégia de conflito: duplicar na importação de dados, nunca decidir o que descartar (instrução explícita do usuário)
  - Testes com Vitest + @testing-library/svelte
- Criado `kanban.md` com todos os itens de `feature_ideas.md` quebrados em cards, todos em **Backlog**.
- Criado este `REGISTRO.md`.
- `git init` no projeto + primeiro commit da documentação de planejamento.
- Adicionado `ARF-001` ao kanban (fundação do projeto, não vinha do pedido do usuário mas é pré-requisito técnico de tudo), SDD escrito em `sdd/ARF-001-project-scaffolding.md`.
- `npm install` das dependências de dev: typescript, vite, @crxjs/vite-plugin, @sveltejs/vite-plugin-svelte, svelte, vitest, jsdom, @testing-library/svelte, @types/chrome.
- Scaffolding criado: `manifest.json` (MV3), `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, estrutura `src/{background,newtab,shared}`, primeiro teste em `tests/shared/messaging.test.ts`.
- Validado: `npm run typecheck` ok, `npm run test` ok (3 testes), `npm run build` gera `dist/` carregável.
- **Instalada a extensão de desenvolvimento (`dist/`) no Chrome real do usuário** via `chrome-devtools-mcp` (`install_extension`) para validação end-to-end — id gerado pelo Chrome: `panheaopikfnpjgmipfnjjjdagfhifkg`. Confirmado visualmente: new-tab da extensão carrega e mostra "service worker: online" (ping/pong real entre newtab e background). Essa é uma extensão **não-empacotada** (modo dev); pode ser removida em `chrome://extensions` a qualquer momento sem afetar nada.
- `ARF-001` movido Backlog → Ready → In Progress → **Done** no kanban.
- SDD `ARF-020/021` escrito (modelo de dados Group+SavedTab e camada de storage IndexedDB).
- `npm install idb` (wrapper IndexedDB) e `npm install -D fake-indexeddb` (IndexedDB em memória para testes, sem precisar de browser).
- Implementado `src/shared/types.ts` (Group, SavedTab), `src/shared/storage.ts` (CRUD completo com cascata ao deletar grupo, ordenação com pin no topo), `src/background/router.ts` (roteador puro de mensagens, testável sem `chrome.*`), mensagens novas em `src/shared/messaging.ts` (LIST_GROUPS, CREATE_GROUP, LIST_TABS_BY_GROUP, ADD_TAB).
- Renomeado alias de import de `@shared/*` para `@/*` (aponta pra `src/`) para cobrir também `@/background/*` nos testes, mantendo um único alias em vez de dois.
- 17 testes passando (3 de messaging, 8 de storage, 4 de router — fake-indexeddb, sem mock manual de `chrome.*`).
- Build + reload da extensão já instalada no Chrome real: criado grupo "Teste E2E" via `chrome.runtime.sendMessage` direto no console da new-tab, confirmado que persiste e é listado de volta — camada completa (UI → mensagem → router → IndexedDB real) validada ponta a ponta.
- **Nota de limpeza**: o grupo "Teste E2E" ficou no IndexedDB local da extensão de desenvolvimento (tentativa de `indexedDB.deleteDatabase` deu timeout porque o service worker mantém a conexão aberta — comportamento esperado do IndexedDB, não é bug). Sem impacto: é a extensão de dev instalada só para validação, não interfere com Session Buddy/TabStack/Tab Group/Tabliss reais.
- `ARF-020/021` movido para **Done** no kanban.
- Discussão aprofundada sobre escolha de backend (Supabase vs PocketBase vs self-host), peso de cada cliente no bundle, e viabilidade de manter o Supabase no free tier para sempre.
- **Correção pública de um erro meu**: inicialmente recomendei `pg_cron` interno como solução confiável contra a pausa por inatividade do Supabase. Pesquisa mais profunda nas fontes primárias (FAQ oficial do Supabase + discussões técnicas no GitHub deles) mostrou que isso **não é confirmado** — a documentação oficial só reconhece tráfego real de API vindo de fora como critério válido. Corrigi a recomendação para o usuário nessa mesma conversa.
- Novo requisito do usuário (Tema A3 em `feature_ideas.md`): extensão precisa degradar graciosamente se o Supabase ficar inacessível — continuar 100% funcional com os dados locais (IndexedDB), mostrar um card discreto e fixo na new-tab avisando, e retomar sync automaticamente quando a conexão voltar.
- Decisão do usuário (Tema A4): **adiar** a implementação de keep-alive externo contra a pausa do Supabase. Não é esquecimento — é decisão consciente, documentada, revisitável se a pausa virar problema recorrente na prática.
- Documentado em `docs/architecture/decisions.md`: ADR-010 (resiliência local-first com fallback gracioso) e ADR-011 (keep-alive adiado, com a justificativa técnica completa).
- `kanban.md` atualizado: ARF-012 (fila de sync) teve o escopo explicitamente ampliado para cobrir resiliência; novo card ARF-017 (indicador de status de sync na new-tab); novo card ARF-018 (keep-alive externo, marcado como adiado conforme ADR-011).
- Usuário criou o projeto Supabase (`arfyin`, região São Paulo). Orientei ajustes no formulário de criação: pular integração com GitHub (manter schema aplicado manualmente via SQL Editor, sem dependência extra), desmarcar "Grant API access to new tables automatically" (recomendação da própria Supabase), marcar "Enable RLS on new tables automatically" (fail-closed por padrão), não usar OrioleDB (beta, não recomendado).
- Usuário passou as credenciais: Project URL (`https://fmcfxfuzxynxtebgekcr.supabase.co`, derivada do Data API URL que ele copiou) e a Publishable key (`sb_publishable_...`). Nota: a Supabase renomeou "anon key" para "Publishable key" e "service_role" para "Secret key" em 2026 (nomenclatura legada será desativada em 2027) — variáveis de ambiente já usam o nome novo.
- Criado `.env` local (gitignored, confirmado via `git check-ignore`) com as credenciais reais. `.env.example` atualizado com a nomenclatura nova e uma nota explicando.
- `ARF-010` desbloqueado: SDD escrito (`sdd/ARF-010-supabase-schema.md`), movido Backlog → Ready → In Progress.
- Implementado: `npm install @supabase/supabase-js`; migração SQL em `supabase/migrations/0001_groups_and_tabs.sql` (tabelas `groups`/`tabs`, RLS por `auth.uid()`, GRANT só para `authenticated`); `src/shared/supabaseClient.ts` (factory do client); `src/shared/remote.ts` (push/pull de grupos e abas, convertendo camelCase↔snake_case).
- 22 testes passando (5 novos de `remote.ts`, com um fake client — sem rede real). Typecheck e build seguem limpos.
- **Mudança de plano**: usuário pediu para automatizar a aplicação de SQL em vez de ficar colando manualmente no painel. Pesquisei alternativas (Supabase CLI, Management API, MCP oficial, integração GitHub) e documentei em ADR-012.
- Usuário gerou um Personal Access Token (PAT) do Supabase. Primeira proposta minha foi permissões granulares (`database:read-write` + `Project: read` + `Auth` para o futuro ARF-011, resto `None`, `Account/organization` sempre `None`). Usuário preferiu **"Full access" escopado só ao projeto `arfyin`** (não à organização) — alertei sobre o único risco residual relevante (capacidade de deletar o projeto, ação irreversível) antes de prosseguir; decisão consciente dele.
- **Executei a migração `0001_groups_and_tabs.sql` diretamente via Supabase Management API** (`curl` contra `POST /v1/projects/fmcfxfuzxynxtebgekcr/database/query`, HTTP 201). Validei com uma query extra (`pg_tables`) confirmando que `groups` e `tabs` existem com `rowsecurity = true`.
- **Configurado o MCP oficial do Supabase** (`claude mcp add supabase --scope user --env SUPABASE_ACCESS_TOKEN=... -- npx -y @supabase/mcp-server-supabase@latest --project-ref=fmcfxfuzxynxtebgekcr`) — token salvo só em `~/.claude/.claude.json` (fora do repo), servidor escopado só a este projeto. Conectado (`claude mcp list` confirma). As ferramentas em si só aparecem depois de um reload da sessão (mesmo comportamento observado com o `chrome-devtools-mcp` no início do projeto).
- `ARF-010` movido para **Done** no kanban — schema aplicado e validado em produção.
- Documentado em `docs/architecture/decisions.md`: ADR-012 (automação de schema via Management API/MCP, sem GitHub integration, tratamento do PAT).

## 2026-11-20 (continuação) — primeira auditoria com o MCP do Supabase

- Reload do VSCode confirmado: ferramentas `mcp__supabase__*` disponíveis (list_tables, execute_sql, apply_migration, get_advisors, list_migrations, etc.).
- `list_tables` confirmou `groups`/`tabs` com RLS habilitado, colunas e FKs batendo com o schema planejado.
- `get_advisors(security)` acusou 2 avisos: a função `public.rls_auto_enable()` (gerada automaticamente pelo Supabase por causa da opção "Enable RLS on new tables automatically" marcada na criação do projeto) estava exposta via RPC público para `anon`/`authenticated`. Investiguei a definição da função antes de mexer (não é código nosso, é um event trigger interno deles) e corrigi revogando `EXECUTE` — primeiro só de `anon`/`authenticated` (não resolveu, advisor continuou acusando), depois entendi que o Postgres concede `EXECUTE` a `PUBLIC` por padrão em funções novas e revoguei de `PUBLIC` também. Advisors de segurança zerados depois disso.
- `get_advisors(performance)` acusou: FK `tabs.group_id` sem índice dedicado cobrindo (o índice composto existente não cobre buscas só por `group_id`) e as 8 policies de RLS reavaliando `auth.uid()` por linha em vez de uma vez por query. Corrigido: índice `tabs_group_id_idx` + todas as policies reescritas com `(select auth.uid())` (recomendação oficial da documentação do Supabase). Terceiro achado ("índices nunca usados") é ruído esperado — banco ainda vazio, sem tráfego real — não exige ação.
- Todas as correções aplicadas via `apply_migration` (não `execute_sql`) para ficarem no histórico formal do Supabase (`list_migrations` confirma). Espelhadas localmente em `supabase/migrations/0002_security_performance_fixes.sql`.
- Formalizada em ADR-012 a prática de sempre rodar `get_advisors` depois de qualquer DDL.

## 2026-11-20 (continuação) — ARF-012 e início de execução contínua (sem check-in por card)

> A partir daqui, a pedido do usuário, deixo de parar para validar cada card individualmente — registro continua completo, mas sem pausar o fluxo.

- `ARF-012` implementado: IDB bump v1→v2 com `sync_queue`/`meta` stores (upgrade incremental, não quebra o banco já existente no Chrome real do usuário); `src/shared/sync.ts` (enqueue/drain, para no 1º erro preservando o resto da fila); `remote.ts` ganhou `deleteRemoteGroup`/`deleteRemoteTab`; `router.ts` enfileira+dispara sync (fire-and-forget, nunca bloqueia a resposta) em toda mutação; `chrome.alarms` a cada 15min como rede de segurança. `getCurrentUserId`/`getRemoteDb` já ligados de verdade ao `supabase-js` (sem sessão ainda — ARF-011 — `drainQueue` simplesmente não roda, fila fica intacta).
- Vitest configurado para **nunca** carregar o `.env` real durante os testes (sobrescrito para vazio em `vite.config.ts`) — isolamento de rede garantido mesmo com credenciais reais no projeto.
- 28 testes passando. Build confirma a arquitetura: bundle do background subiu pra ~59KB gzip (entrou o `supabase-js`), bundle da new-tab continua em ~17KB gzip, inalterado — exatamente a garantia do ADR-002/003 (peso de biblioteca fica isolado no processo central).
- `ARF-012` → Done.
- Implementado o epic **CORE** completo (ARF-022/023/024/025/026/027) e **INTERACT** completo (ARF-080/081/082/083/084) numa fatia vertical só: `store.svelte.ts` (estado central Svelte 5 runes, estratégia "refetch tudo após mutação"), `dragdrop.ts` (protocolo único de DnD reusável pelo card LIVE depois), componentes `TabManager`/`GroupItem`/`TabItem`/`UngroupedSection`/`SyncStatusBanner` (ARF-017, que também ficou pronto nessa leva).
- Simplificação consciente registrada no SDD: modo de ordenação "misturado" (abas soltas intercaladas entre grupos) não implementado — exigiria campo de ordem compartilhado entre duas entidades diferentes, modelagem nova. Implementado "Manual" vs "Alfabética" (grupos), abas soltas sempre numa seção separada.
- **Validado no Chrome real** (não só testes unitários): reload da extensão, criação de grupo via mensagem direta, adição de aba, clique real no botão de pin (confirmado no IndexedDB real que `pinned: true` persistiu), renderização correta de toda a árvore de componentes. Dados de teste limpos ao final.
- Trade-off registrado: componentes Svelte não ganharam testes de componente isolados nesta rodada (tempo) — lógica de mutação já está coberta nos testes de `storage.ts`; cobertura de UI fica para o card e2e (ARF-110).
- Implementado o epic **LIVE** completo (ARF-030 a ARF-034): `liveTabsBroadcast.ts` no background (listeners de `chrome.tabs`/`chrome.windows`, broadcast via `chrome.runtime.Port` — sem polling, exatamente como o ADR-003 já previa desde o scaffolding), `liveTabs.ts` com função pura `toLiveWindows` (testável sem `chrome.*` real), componentes `LiveWindows`/`LiveWindowSection`/`LiveTabItem`. Drag de aba/janela viva pra um grupo: sem modificador salva mantendo aberta; com Option/Alt no momento do drop, fecha a aba/janela original depois de salvar.
- **Validado no Chrome real com os dados reais do usuário**: a extensão mostrou corretamente as 2 janelas reais dele (28 e 42 abas) via Port, sem nenhuma configuração manual — confirma a feature mais pedida por ele ("ver todas as abas abertas organizadas por janela") funcionando de ponta a ponta.
- 38 testes passando.
- Implementado **ZEN** (ARF-070, espaço alterna, ignora quando foco está em input/textarea/contenteditable) e **QUICK** (ARF-100 a 103: novo object store `config` no IDB, bump v2→v3, até 9 itens, tecla 1-9 com foco, Cmd/Ctrl+tecla sem foco, tecla 0 abre todos — lógica de resolução de tecla isolada em função pura testada, `resolveQuickAccessKey`).
- 42 testes passando. Validado no Chrome real.
- Implementado **export/import** (ARF-013 a 016): `exportAllData`/`importDataExport` (duplica tudo via `createGroup`/`addTabToGroup` reaproveitados — preserva invariantes de `order`) e `exportConfig`/`importConfigExport` (substitui). UI `BackupControls.svelte` (baixa `.json` via blob, importa via `<input type=file>`). 47 testes passando (1 bug de teste corrigido: expectativa não contava o grupo original junto do duplicado).
- Validado no Chrome real: criar grupo, exportar, importar o mesmo dump — total de grupos foi de 1 para 2, confirmando duplicação real via mensagens reais.
