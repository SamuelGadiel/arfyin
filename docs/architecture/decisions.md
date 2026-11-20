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
