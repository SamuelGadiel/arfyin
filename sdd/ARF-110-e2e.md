# SDD — ARF-110: testes e2e com Playwright

## Contexto
Os componentes Svelte desta sessão foram validados manualmente no Chrome real (via `chrome-devtools-mcp`), não por testes automatizados de UI — trade-off registrado nos SDDs do CORE/LIVE/THEME. Este card fecha parte dessa lacuna com uma suíte e2e mínima, real (extensão carregada de verdade, não mockada).

## Escopo
Setup do Playwright carregando a extensão **buildada** (`dist/`) via `launchPersistentContext` com `--load-extension`, cobrindo 2 fluxos críticos: (1) a new-tab abre e mostra a UI; (2) criar um grupo e confirmar que ele aparece na lista.

## Critérios de aceite
- [x] `playwright.config.ts` + script `npm run test:e2e`.
- [x] Teste usa `page.on("dialog")` para responder automaticamente ao `prompt()` de criar grupo (mesmo problema que o `chrome-devtools-mcp` tem com dialogs nativos — Playwright resolve isso nativamente).
- [x] Roda contra `dist/`, exigindo `npm run build` antes (documentado no script).

## Design técnico
Extensões MV3 em Playwright exigem `headless: false` (dialogs/service workers de extensão não funcionam bem em modo headless) e `chromium.launchPersistentContext` (não `chromium.launch` simples). O ID da extensão muda a cada carregamento de pasta não-empacotada sem chave fixa — o teste descobre o ID via `context.serviceWorkers()` em vez de hardcodar.

**Achado durante a implementação**: `channel: "chrome"` (Chrome real instalado no sistema) nunca registra o service worker da extensão nesse ambiente (timeout, sem erro) — trocado para o Chromium bundled do Playwright (`npx playwright install chromium`, sem `channel`), que funciona.

## Testes previstos
Este próprio card É a suíte de testes — não tem "teste do teste". Cobertura deliberadamente mínima (2 fluxos) para não transformar isso num projeto à parte; expandir según necessidade real, não antecipadamente (YAGNI).
