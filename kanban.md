# kanban.md — arfyin

> Quadro de rastreabilidade do projeto. Fluxo: **Backlog** → (SDD escrito em `sdd/`) → **Ready** → **In Progress** → **Done**. **Blocked** é usado quando algo externo impede o andamento (ex.: decisão pendente, dependência não resolvida). Cada card referencia a seção correspondente em `feature_ideas.md` (temas A–J) quando aplicável.
>
> Convenção de ID: `ARF-NNN`.

## Backlog

| ID | Epic | Card | Ref. |
|---|---|---|---|
| ARF-011b | SYNC | Validar o fluxo real de login com Google de ponta a ponta assim que o usuário configurar Google Cloud OAuth Client + Supabase Auth Provider (ver sdd/ARF-011-google-auth.md) | A1 |
| ARF-018 | SYNC | Keep-alive externo (cron na Oracle Cloud do usuário contra pausa do Supabase) — **adiado, ver ADR-011**: só implementar se a pausa virar problema recorrente na prática | A4, ADR-011 |
| ARF-040 | PERSIST (v2) | Toggle: extensão assume persistência de sessão (desliga restore nativo do Chrome) | D1, D2 |
| ARF-041 | PERSIST (v2) | Monitoramento em background funcionando sem nenhuma new-tab aberta | D3 |
| ARF-120 | RELEASE | Empacotamento + checklist de publicação na Chrome Web Store | — |

## Ready

*(vazio — cards entram aqui quando o SDD correspondente é escrito em `sdd/`)*

## In Progress

*(vazio)*

## Blocked

| ID | Epic | Card | Motivo |
|---|---|---|---|
| ARF-063 | THEME | Fonte Unsplash com tópicos configuráveis | Precisa de API key de um Unsplash Developer Account do usuário — `source.unsplash.com` (sem key) está morto desde 2024 (503). A API oficial exige `Authorization: Client-ID <key>`. Mesmo padrão do Supabase/Google: só o usuário pode criar essa credencial. |

## Done

| ID | Epic | Card | SDD |
|---|---|---|---|
| ARF-001 | SETUP | Scaffolding do projeto: MV3 + TS + Vite + Svelte + estrutura de pastas + pipeline de testes | [sdd/ARF-001-project-scaffolding.md](sdd/ARF-001-project-scaffolding.md) |
| ARF-020/021 | CORE | Modelo de dados (Group + SavedTab) + camada de storage local (IndexedDB) | [sdd/ARF-020-021-data-model-and-storage.md](sdd/ARF-020-021-data-model-and-storage.md) |
| ARF-010 | SYNC | Schema Supabase (tabelas `groups`, `tabs`) + RLS por usuário + cliente `supabase-js` — migração aplicada e validada em produção via Management API | [sdd/ARF-010-supabase-schema.md](sdd/ARF-010-supabase-schema.md) |
| ARF-012 | SYNC | Fila de sync local↔Supabase, resiliente (para no 1º erro, preserva fila, status idle/syncing/unreachable), drenagem no alarme periódico e após cada mutação | [sdd/ARF-012-sync-queue.md](sdd/ARF-012-sync-queue.md) |
| ARF-017 | SYNC | Card discreto e fixo na new-tab indicando sync fora do ar (poll a cada 30s) | — (implementado junto do ARF-022/027, ver SDD) |
| ARF-022/023/024/025/026/027 | CORE | UI completa de grupos/abas: render, colapsar, drag-and-drop (reorder+move), criar grupo, ordenação manual/alfabética | [sdd/ARF-022-027-core-ui.md](sdd/ARF-022-027-core-ui.md) |
| ARF-080/081/082/083/084 | INTERACT | Clique com/sem foco, abrir grupo inteiro, cor/ícone de grupo, pin de aba | [sdd/ARF-022-027-core-ui.md](sdd/ARF-022-027-core-ui.md) |
| ARF-030/031/032/033/034 | LIVE | Abas/janelas abertas em tempo real (Port, sem polling), drag para grupo com/sem fechar original | [sdd/ARF-030-034-live-tabs.md](sdd/ARF-030-034-live-tabs.md) |
| ARF-070 | ZEN | Barra de espaço → modo zen, por aba | [sdd/ARF-070-zen-mode.md](sdd/ARF-070-zen-mode.md) |
| ARF-100/101/102/103 | QUICK | Acesso rápido 1-9, modificador sem foco, tecla 0 abre todos | [sdd/ARF-100-103-quick-access.md](sdd/ARF-100-103-quick-access.md) |
| ARF-013/014/015/016 | SYNC | Exportar/importar dados (duplica) e configuração (substitui) | [sdd/ARF-013-016-backup.md](sdd/ARF-013-016-backup.md) |
| ARF-090/091/092/093 | LAYOUT | 3 modos de layout (coexistente/scroll-reveal/sem relógio) + Clock básico | [sdd/ARF-090-093-layout.md](sdd/ARF-090-093-layout.md) |
| ARF-060/061/062/064/065/066/067/068 | THEME | Background (cor/local/reddit) + darken/blur + navegação + frequência + relógio customizável | [sdd/ARF-060-068-theme.md](sdd/ARF-060-068-theme.md) |
| ARF-050/051 | PERF | Validado empiricamente no Chrome real: First Contentful Paint em 184ms (leitura 100% local, sem round-trip de rede) | — |
| ARF-011 | SYNC | Login com Google via Supabase (`signInWithIdToken` + `launchWebAuthFlow`) — código completo e validado (sem quebrar sem credencial); fluxo real ainda não testável, ver Backlog | [sdd/ARF-011-google-auth.md](sdd/ARF-011-google-auth.md) |
| ARF-110 | QA | 2 testes e2e com Playwright, extensão carregada de verdade (dist/), dialogs tratados via `page.on("dialog")` | [sdd/ARF-110-e2e.md](sdd/ARF-110-e2e.md) |
