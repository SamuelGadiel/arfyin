# Decisões de arquitetura — arfyin

> Registro de decisões técnicas tomadas de forma autônoma (o usuário pediu para não ser consultado em decisões de stack/arquitetura — ele quer ficar na posição macro). Cada decisão documenta a alternativa escolhida e o porquê, para que qualquer sessão futura do Claude (ou o próprio Samuel) entenda o raciocínio sem precisar perguntar de novo.

## ADR-001 — Plataforma e linguagem

**Decisão**: Chrome Extension em **Manifest V3**, **TypeScript**, bundler **Vite + `@crxjs/vite-plugin`**.

**Por quê**: MV3 é o padrão exigido pela Chrome Web Store hoje (MV2 está sendo descontinuado). TypeScript dá segurança de tipos num domínio com muitos formatos de dados (tabs, grupos, config, payloads de sync) — crítico para "zero perda de dados" (requisito A1). Vite+CRXJS é o setup mais leve e rápido para extensões MV3 modernas (HMR funcional em dev, build de produção otimizado), evitando a complexidade de webpack manual.

## ADR-002 — UI da new-tab

**Decisão**: **Svelte 5** (compilado, sem runtime framework pesado) para a UI da new-tab.

**Por quê**: Requisito E1/E3 exige baixo consumo de memória e carregamento instantâneo. Svelte compila para JS vanilla otimizado, sem virtual DOM nem runtime grande — é a opção mais alinhada a "leve e instantâneo" entre React/Vue/Svelte/Solid. Drag-and-drop (Tema C) e reatividade fina (grupos colapsáveis, zen mode por aba) se beneficiam do modelo reativo do Svelte sem boilerplate.

## ADR-003 — Processo central e comunicação

**Decisão**: O **service worker** (background, MV3) é o processo central único (requisito E2). Toda leitura/escrita de dados passa por ele via `chrome.runtime` messaging (request/response) + uma `Port` de longa duração para updates ao vivo (abas/janelas abertas, Tema C1).

**Por quê**: É exatamente o papel que o MV3 já reserva para o background script — um único processo por extensão, compartilhado por todas as abas. Nenhuma new-tab deve conter lógica de monitoramento de tabs/windows duplicada; elas são clientes "burros" que consultam o service worker.

**Restrição técnica importante**: service workers MV3 são **efêmeros** (o Chrome pode descarregá-los a qualquer momento e religar no próximo evento). Isso significa que **nenhum estado pode viver só em memória** no service worker — tudo que importa (cache de dados, fila de sync pendente) precisa estar em storage durável (IndexedDB) e ser **rehidratado** a cada wake-up. Esse ponto é crítico para o requisito D3 (monitoramento tem que sobreviver mesmo sem new-tab aberta).

## ADR-004 — Armazenamento local (cache)

**Decisão**: **IndexedDB** (via wrapper leve, `idb`) como cache local/fonte-da-verdade-offline, acessível tanto pelo service worker quanto pelas páginas de new-tab.

**Por quê**: `chrome.storage.sync` tem limite de ~100KB total / 8KB por item — inviável para centenas de abas salvas (já vimos 305 links só no Tab Group do usuário). `chrome.storage.local` tem limite maior mas é um key-value simples, sem índices — IndexedDB permite queries por grupo, por janela, etc., e lida bem com grandes volumes (igual ao que o Session Buddy já faz). Atende diretamente o requisito E4 (leitura instantânea sem tocar a rede).

## ADR-005 — Backend de sincronização

**Decisão**: **Supabase** (Postgres + Auth + Row Level Security) como backend de nuvem.

**Por quê**: Requisito A1 pede "algo" de sync — gist, Firebase, Supabase ou Drive foram as opções citadas pelo próprio usuário. Supabase foi escolhido porque: (a) já é um padrão **validado na prática** — o TabStack (uma das extensões concorrentes já analisadas, ver `docs/research/chrome-context.md`) usa exatamente Supabase com sucesso para esse mesmo tipo de produto; (b) dá Postgres real (schema relacional para grupos/abas/config, fácil de evoluir); (c) Auth + RLS resolvem "logar num computador novo e carregar tudo" (requisito A1) sem precisar construir backend próprio; (d) tier gratuito é suficiente para uso pessoal de um usuário. Alternativas descartadas: Firebase (Firestore é NoSQL, pior fit pra dados relacionais de grupo→aba); Google Drive API (mais fricção de auth/escopo, modelo de arquivo não é natural para dados estruturados); Gist (não tem auth multi-dispositivo nativo nem controle de acesso, seria gambiarra).

## ADR-006 — Autenticação

**Decisão**: Supabase Auth com provedor **Google OAuth**, via `chrome.identity.launchWebAuthFlow`.

**Por quê**: O usuário já vive no ecossistema Google (Gmail fixado nos favoritos, Google Drive citado como opção). OAuth com Google é o caminho de menor fricção para "logar num computador novo". Mesmo padrão tecnicamente provado pelo TabStack.

## ADR-007 — Estratégia de sincronização e conflitos

**Decisão**: Cada registro (aba salva, grupo, item de config) tem um `id` (UUID) + `updated_at`. Sync em background = *upsert* por `id` (last-write-wins natural, já que é uso single-user na prática). **Import de dump de dados sempre duplica** (gera novos UUIDs e insere como registros novos) — nunca tenta decidir o que descartar, conforme instrução explícita do usuário (Tema A2). **Import de config é substituição total** (config é um objeto único, não uma lista — não há o que "duplicar"; o usuário decide se quer substituir via confirmação na própria UI da extensão, não é uma decisão de arquitetura).

## ADR-008 — Testes

**Decisão**: **Vitest** para testes unitários (data layer, sync, reducers, utilitários de storage) + **@testing-library/svelte** para componentes. E2E de extensão (Playwright com extensão carregada) fica registrado como card de backlog separado, não bloqueante para o MVP.

**Por quê**: Vitest compartilha config com Vite (zero setup duplicado), é rápido, e é o padrão de facto para projetos Vite/Svelte em 2026.

## ADR-009 — Estrutura de pastas

```
arfyin/
  src/
    background/       # service worker (processo central)
    newtab/            # app Svelte da new-tab
    shared/            # tipos, data layer, cliente de sync, utils — usado por background e newtab
  tests/               # specs unitárias/componentes (mirror de src/)
  sdd/                 # specs de design de cada feature antes de implementar
  docs/
    research/          # já existente — pesquisa de mercado/concorrência
    architecture/       # este arquivo
  .claude/
    agents/            # subagentes especializados deste projeto
  feature_ideas.md
  kanban.md
  REGISTRO.md
```

**Por quê**: Separação simples por responsabilidade (background / UI / compartilhado), sem monorepo multi-package — não há necessidade real de publicar `shared` separadamente (YAGNI). `sdd/` e `kanban.md` existem para rastreabilidade, conforme pedido explícito do usuário.

## ADR-010 — Resiliência de sync: local-first com fallback gracioso

**Decisão**: A UI (new-tab) **nunca** lê diretamente da nuvem. Toda leitura vem do IndexedDB local (já implementado em ARF-020/021); toda escrita do usuário grava no IndexedDB **primeiro** (otimista) e só depois é enfileirada para sync com o Supabase. O service worker mantém um `syncStatus` (`idle` | `syncing` | `unreachable` — nomenclatura real do código; corrigido aqui em 2026-11-21, o texto original desta decisão dizia `synced`/`pending`, que nunca existiram de fato) persistido, que a new-tab consulta. Quando `syncStatus === "unreachable"` por mais que um pequeno debounce (pra não piscar aviso em uma falha de rede de 1 segundo), a UI mostra um **card fixo e discreto** avisando que a sincronização está fora do ar. Quando a conexão volta, a fila de pendências é drenada automaticamente, sem ação manual do usuário (exceto reativar o projeto no painel do Supabase, se for esse o motivo da falha).

**Por quê**: Requisito A3 do usuário — a extensão não pode nunca parar de funcionar por causa da nuvem estar indisponível (projeto Supabase pausado, sem internet, etc.). Essa decisão também é o que torna segura a decisão ADR-011 (adiar o keep-alive): como a extensão degrada graciosamente, uma eventual pausa do Supabase vira um aviso visual, não uma falha funcional.

## ADR-011 — Keep-alive contra pausa do Supabase: adiado por decisão do usuário

**Decisão**: Não implementar, por enquanto, nenhum mecanismo de keep-alive contra a pausa por inatividade do Supabase free tier.

**Investigação feita**: avaliamos `pg_cron` (job agendado rodando dentro do próprio Postgres) como possível solução. Pesquisa aprofundada em fontes primárias (FAQ oficial da Supabase, discussões técnicas no GitHub oficial deles) **não confirma** que atividade puramente interna do Postgres conta para o critério de "atividade" que evita a pausa — a documentação oficial fala exclusivamente em "abrir o dashboard" ou "requisições reais vindas do seu app" (tráfego de API externo). Um colaborador da comunidade no GitHub da Supabase levanta a hipótese de que atividade interna (autovacuum, `pg_cron`, etc.) seja especificamente filtrada do critério, para impedir esse tipo de "truque". Conclusão: `pg_cron` interno é uma aposta não-documentada, não uma solução confirmada.

**A solução que teria respaldo real**, se fosse necessária: um cron **externo**, fora do Postgres, fazendo uma chamada HTTP real contra a API REST do Supabase — por exemplo, um script simples agendado no servidor Oracle Cloud do usuário (sempre ligado, independente do Chrome estar aberto ou não), inserindo uma linha numa tabela de heartbeat via requisição à API. Isso se encaixa exatamente no critério documentado ("sending real requests from your app").

**Por quê adiar mesmo assim**: decisão do usuário, não técnica — ele não espera ficar uma semana sem abrir o Chrome; se acontecer, é pontual e reativar manualmente no painel é aceitável. A decisão só é segura porque o ADR-010 garante que uma pausa nunca quebra a extensão, apenas aciona um aviso visual. Revisitar **somente se a pausa virar um problema recorrente na prática** — não implementar preventivamente (YAGNI).

## ADR-012 — Automação de schema: Management API + MCP, sem GitHub integration

**Decisão**: Mudanças de schema no Supabase (migrações) são aplicadas diretamente por mim via **Supabase Management API** (`POST /v1/projects/{ref}/database/query`) e, a partir de agora, via o **MCP oficial do Supabase** (`@supabase/mcp-server-supabase`, rodando localmente via `npx`, escopado ao projeto `arfyin` via `--project-ref`). O arquivo `supabase/migrations/*.sql` no repositório continua existindo como **histórico documentado** do que foi aplicado, mas não é a fonte que efetivamente aplica a mudança.

**Por quê não GitHub integration**: a Supabase oferece deploy automático de migrações a partir de um repositório conectado. Descartado para não criar dois mecanismos paralelos de aplicar schema (push automático da Supabase + eu aplicando direto via API/MCP) — risco de divergência entre o que está documentado no repo e o que foi efetivamente rodado. Mantemos uma única fonte de aplicação real.

**Credencial usada**: Personal Access Token (PAT) do Supabase, gerado pelo usuário com **"Full access" escopado somente ao projeto `arfyin`** (não à organização). Decisão consciente do usuário após eu apresentar a alternativa de permissões granulares (`database:read-write` apenas) — ele preferiu simplicidade a granularidade fina, aceitando o único risco residual relevante (capacidade de deletar o projeto via API, ação irreversível, mas de baixa probabilidade de ocorrer por engano). O token:
- **Nunca é commitado no repositório.** Fica apenas na configuração do MCP em `~/.claude/.claude.json` (escopo `user`, fora da pasta do projeto) — mesmo tratamento dado às credenciais do `.env`.
- Está restrito a este projeto Supabase (`--project-ref=fmcfxfuzxynxtebgekcr`), nunca alcança outros projetos ou a organização.

**Validação feita**: migração `0001_groups_and_tabs.sql` aplicada via Management API (HTTP 201) e confirmada com uma query de verificação (`pg_tables` mostrando `groups`/`tabs` com `rowsecurity = true`).

**Adendo (ARF-011)**: `chrome.identity.getAuthToken()` retorna um access token, não um ID token — `supabase.auth.signInWithIdToken()` exige especificamente um ID token. O fluxo implementado usa `chrome.identity.launchWebAuthFlow()` construindo a URL de autorização do Google manualmente (`response_type=id_token`), conforme padrão confirmado em discussões da própria comunidade Supabase. Também foi necessário trocar o `storage` do `supabase-js` de `localStorage` (padrão, inexistente no service worker) para um adapter baseado em `chrome.storage.local`, único storage realmente compartilhado entre o background e as páginas da extensão — sem isso, um login feito na new-tab nunca seria visto pelo processo central responsável pelo sync.

**Prática adotada a partir de agora**: com o MCP ativo, mudanças de schema (DDL) são aplicadas via `apply_migration` (não `execute_sql`, que é só para leitura/diagnóstico) — é o que registra a mudança no histórico formal de migrations do próprio Supabase (`list_migrations`). E **sempre rodar `get_advisors` (security + performance) logo depois de qualquer DDL**, conforme a própria instrução do servidor MCP recomenda — foi assim que pegamos, logo na primeira migração, uma função interna do Supabase (`rls_auto_enable`, criada automaticamente pela opção "Enable RLS on new tables automatically") exposta sem necessidade via RPC público, e duas otimizações de RLS/índice. Todas as correções viram migração própria em `supabase/migrations/`, mantendo o repo como espelho fiel do que foi aplicado.

**Atualização (2026-11-21)**: a configuração do MCP (`chrome-devtools` + `supabase`) foi movida de user-scope (`~/.claude/.claude.json`) para **project-scope** (`.mcp.json`, versionado na raiz do repo) — ver ADR-013.

## ADR-013 — Config de MCP movida para escopo de projeto (`.mcp.json`)

**Contexto**: os servidores `chrome-devtools` e `supabase` tinham sido registrados em user-scope, na config da conta "pessoal" (`~/.claude/.claude.json`). Depois de uma troca de conta Claude (limite de uso estourado), a sessão passou a rodar sob outra `CLAUDE_CONFIG_DIR` (conta "work", `~/.claudew`), que não tem esses servidores — eles "sumiram" não por terem sido removidos, mas por estarem amarrados à conta errada.

**Decisão**: registrar os dois servidores em `.mcp.json` na raiz do repositório (project-scope), versionado no git. Isso os torna **independentes de qual conta/`CLAUDE_CONFIG_DIR` está ativa** — qualquer sessão aberta a partir deste diretório os carrega.

**Segredo do Supabase (PAT)**: o `.mcp.json` versionado referencia `"${SUPABASE_ACCESS_TOKEN}"` (expansão de variável de ambiente do próprio Claude Code), nunca o valor literal — evita vazar o PAT no histórico do git. O valor real foi exportado (a) no `~/.zshrc` do usuário e (b) via `launchctl setenv`, necessário porque apps GUI (VSCode) no macOS herdam variáveis de ambiente apenas no momento em que o processo é iniciado — "Reload Window" não basta, precisa fechar e reabrir o app por completo.

**Trade-off aceito**: qualquer colaborador futuro que clonar o repo precisa ter sua própria `SUPABASE_ACCESS_TOKEN` exportada para o `supabase` MCP funcionar — aceitável, é um projeto pessoal de um único desenvolvedor.

## ADR-014 — Sincronizar `AppConfig` (tema/layout/acesso rápido) com o Supabase

**Contexto**: a auditoria ARF-140 encontrou que só dados (grupos/abas) sincronizavam — config só viajava entre máquinas via export/import manual. Decisão explícita do usuário: sincronizar também.

**Decisão**: nova tabela `public.config` (schema: `user_id uuid primary key`, `data jsonb`, `updated_at`) — uma linha por usuário, o `AppConfig` inteiro serializado como JSON, não colunas separadas. Evita migração de schema toda vez que um campo novo é adicionado ao `AppConfig` (já aconteceu 2x nesta mesma sessão: `fontWeight`/`dateFormat` no relógio). Mesmo padrão `enqueue*`/`push*`/`pull*`/`merge*FromRemote` (last-write-wins por `updatedAt`) já usado para grupos/abas — `AppConfig` ganhou um campo `updatedAt`, sempre sobrescrito por `setAppConfig` (nunca confiar no valor que o chamador passa), exceto por `mergeConfigFromRemote` (que precisa do timestamp real vindo do servidor pra comparação fazer sentido).

**Achado de processo durante a validação ao vivo**: a primeira tentativa de sync falhou com `permission denied for table config`, mesmo com RLS corretamente configurado. Causa: RLS restringe **quais linhas** uma role vê, mas não concede a operação em si — isso é um `GRANT` de nível de tabela separado, que `groups`/`tabs` já tinham (aplicado implicitamente por alguma configuração anterior do projeto/dashboard) mas a tabela `config`, criada agora via migration pela API, não tinha. Corrigido com `grant select, insert, update, delete on public.config to authenticated;`. **Lição para qualquer tabela nova futura**: SEMPRE incluir o `GRANT` explícito na própria migration que cria a tabela — não presumir que RLS sozinho basta, e não presumir que o Supabase concede isso automaticamente (ele não faz isso de forma confiável via migration aplicada pela Management API/MCP, só quando a tabela é criada por certos fluxos do dashboard).

**Validado ao vivo**: mudei `layoutMode` na extensão real, confirmei a linha aparecendo no Postgres; depois simulei "outro dispositivo" alterando a config direto no banco com um `updated_at` futuro, rodei `BOOTSTRAP_SYNC`, a extensão local adotou o valor remoto.

## ADR-015 — Mensagens que só tocam `chrome.*` (sem IndexedDB) são tratadas fora de `routeMessage`

**Contexto**: ARF-165/166/167 (mover aba viva entre janelas, `chrome.tabs.move`) precisa de um handler no service worker que não lê nem escreve `db` nenhuma — é 100% `chrome.tabs.move`. `routeMessage` (`src/background/router.ts`) é documentado e testado como puro, sem `chrome.*` (`tests/background/router.test.ts` roda com `fake-indexeddb`, zero mock de `chrome`).

**Decisão**: mensagens cujo efeito é 100% `chrome.*` (sem `db: ArfyinDb`) são tratadas num branch direto em `src/background/index.ts`, **antes** de cair em `dbPromise.then(routeMessage)` — não entram no `switch` de `routeMessage`. Isso preserva a garantia de pureza/testabilidade do router sem precisar mockar `chrome.*` nos testes existentes. Continua satisfazendo o ADR-003 ("toda leitura/escrita passa pelo service worker via `chrome.runtime` messaging") — o branch ainda vive dentro do único listener `chrome.runtime.onMessage` do service worker, só não passa pelo `switch` de `routeMessage`.

**Por quê não generalizar agora**: só existe um caso (`MOVE_LIVE_TAB`). Criar uma abstração de "roteador de ações só-chrome" para N=1 caso seria overengineering (YAGNI). **Gatilho explícito para revisar esta decisão**: se um **segundo** tipo de mensagem só-`chrome.*` aparecer, extrair os branches especiais de `index.ts` para um módulo dedicado (ex. `chromeActionsRouter.ts`) em vez de acumular `if`s soltos no listener — nesse ponto, duas ocorrências já justificam a abstração pelo critério DRY/YAGNI já usado no projeto.
