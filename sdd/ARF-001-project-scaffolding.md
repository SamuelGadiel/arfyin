# SDD — ARF-001: Scaffolding do projeto

## Contexto
Nenhuma linha de código existe ainda. Antes de qualquer feature (SYNC, CORE, LIVE, THEME...) precisamos de um projeto que builda, carrega no Chrome como extensão MV3, e tem pipeline de testes funcionando. Ver `docs/architecture/decisions.md` ADR-001/002/008/009.

## Escopo
**Entra**: package.json + scripts, TypeScript config, Vite + CRXJS + Svelte config, `manifest.json` MV3 mínimo (new-tab override + background service worker), estrutura `src/{background,newtab,shared}`, Vitest configurado com 1 teste de exemplo passando, extensão carregando no Chrome via "load unpacked" sem erros.

**Não entra**: qualquer lógica de negócio real (grupos, sync, tema). Isso é fundação vazia, não uma feature.

## Critérios de aceite
- [ ] `npm run build` gera `dist/` carregável via `chrome://extensions` → "Load unpacked" sem erro no console.
- [ ] New-tab abre e renderiza um placeholder Svelte ("arfyin" + confirmação de que o service worker respondeu a uma mensagem de ping).
- [ ] `npm run test` roda e passa (pelo menos 1 teste real, não trivial — testa a função de ping/pong entre newtab e background).
- [ ] `npm run typecheck` passa sem erros.
- [ ] `.gitignore` já cobre `node_modules/`, `dist/`.

## Design técnico
- `manifest.json`: `manifest_version: 3`, `chrome_url_overrides.newtab`, `background.service_worker` (type module), `permissions: ["storage", "tabs"]` (mínimo necessário para o placeholder; permissões de `identity`/host para Unsplash/Reddit/Supabase entram só quando os cards respectivos forem implementados — YAGNI).
- `src/background/index.ts`: registra `chrome.runtime.onMessage`, responde a `{type: "PING"}` com `{type: "PONG", ts: Date.now()}`. Esse ping/pong é o primeiro contrato real entre new-tab e processo central (ADR-003) — serve de base para toda comunicação futura.
- `src/newtab/`: `index.html` + `main.ts` (bootstrap Svelte) + `App.svelte` (chama o background via `chrome.runtime.sendMessage`, mostra o resultado).
- `src/shared/messaging.ts`: tipos das mensagens trocadas (`PingMessage`, `PongMessage`) — primeira peça de `shared/` que será reaproveitada por todas as features futuras de comunicação newtab↔background.

## Casos de borda
- Service worker ainda não "acordou" quando a new-tab manda a primeira mensagem — `chrome.runtime.sendMessage` já lida com isso nativamente (ativa o SW on-demand); não precisa de retry nesta etapa.

## Testes previstos
- Unit (Vitest): a função que monta a `PongMessage` a partir de uma `PingMessage` (lógica pura, sem depender de `chrome.*` real — isola a parte testável do handler).
