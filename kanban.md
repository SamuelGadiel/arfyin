# kanban.md — arfyin

> Quadro de rastreabilidade do projeto. Fluxo: **Backlog** → (SDD escrito em `sdd/`) → **Ready** → **In Progress** → **Done**. **Blocked** é usado quando algo externo impede o andamento (ex.: decisão pendente, dependência não resolvida). Cada card referencia a seção correspondente em `feature_ideas.md` (temas A–J) quando aplicável.
>
> Convenção de ID: `ARF-NNN`.

## Backlog

| ID | Epic | Card | Ref. |
|---|---|---|---|
| ARF-011 | SYNC | Auth via Google OAuth (`chrome.identity.launchWebAuthFlow`) + fluxo de "conectar" em instalação nova | A1, ADR-006 |
| ARF-013 | SYNC | Exportar dump de dados (JSON) | A2 |
| ARF-014 | SYNC | Exportar arquivo de configuração (JSON) | A2 |
| ARF-015 | SYNC | Importar dump de dados — merge por duplicação (nunca decide o que descartar) | A2, ADR-007 |
| ARF-016 | SYNC | Importar configuração — substituição total | A2, ADR-007 |
| ARF-018 | SYNC | Keep-alive externo (cron na Oracle Cloud do usuário contra pausa do Supabase) — **adiado, ver ADR-011**: só implementar se a pausa virar problema recorrente na prática | A4, ADR-011 |
| ARF-030 | LIVE | Service worker: monitorar tabs/windows abertos em tempo real | C1, E2 |
| ARF-031 | LIVE | UI: seção "abas abertas" agrupada por janela | C1 |
| ARF-032 | LIVE | Drag aba viva → grupo (salva, mantém aberta) | C2 |
| ARF-033 | LIVE | Drag aba viva → grupo + modificador (salva e fecha) | C2 |
| ARF-034 | LIVE | Drag janela viva → grupo (mesma lógica de C2/C3, em lote) | C3 |
| ARF-040 | PERSIST (v2) | Toggle: extensão assume persistência de sessão (desliga restore nativo do Chrome) | D1, D2 |
| ARF-041 | PERSIST (v2) | Monitoramento em background funcionando sem nenhuma new-tab aberta | D3 |
| ARF-050 | PERF | Benchmark de tempo de carregamento da new-tab (meta: instantâneo) | E3 |
| ARF-051 | PERF | Cache local servindo leitura sem round-trip de rede | E4 |
| ARF-060 | THEME | Engine de background: imagem + darken + blur configuráveis | F1, F2 |
| ARF-061 | THEME | Widgets centrais (relógio + data no MVP) | F3 |
| ARF-062 | THEME | Navegação próximo/anterior background sem reload da aba | F4 |
| ARF-063 | THEME | Fonte Unsplash com tópicos configuráveis | F5 |
| ARF-064 | THEME | Fonte Reddit (subreddits configuráveis) | F5 |
| ARF-065 | THEME | Fonte cor sólida (paleta + color picker) | F5 |
| ARF-066 | THEME | Fonte imagem(ns) local(is) do usuário, com rotação | F5 |
| ARF-067 | THEME | Configuração de frequência de troca / travar em imagem fixa | F6 |
| ARF-068 | THEME | Customização do relógio (24h/AMPM, fuso, formato data, fonte, tamanho, cor) | F7 |
| ARF-070 | ZEN | Atalho de barra de espaço → modo zen (toggle, por aba) | G1, G2, G3, G4 |
| ARF-090 | LAYOUT | Layout "scroll reveal" (relógio → scroll único → gestão de abas) | I1 |
| ARF-091 | LAYOUT | Layout "coexistente" (relógio + abas no mesmo espaço) | I2 |
| ARF-092 | LAYOUT | Layout "sem relógio" | I3 |
| ARF-093 | LAYOUT | Configuração de qual layout usar | I1, I2, I3 |
| ARF-100 | QUICK | Configuração de até 9 itens de acesso rápido | J1 |
| ARF-101 | QUICK | Atalhos numéricos 1-9 (com foco) | J3 |
| ARF-102 | QUICK | Atalho modificador+número (sem foco) e encadeamento múltiplo | J3 |
| ARF-103 | QUICK | Atalho "abrir todos" (tecla 0) | J3 |
| ARF-110 | QA | Playwright e2e: extensão carregada no Chrome real (fluxos críticos) | — |
| ARF-120 | RELEASE | Empacotamento + checklist de publicação na Chrome Web Store | — |

## Ready

*(vazio — cards entram aqui quando o SDD correspondente é escrito em `sdd/`)*

## In Progress

*(vazio)*

## Blocked

*(vazio)*

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
