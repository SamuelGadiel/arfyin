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
