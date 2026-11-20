# SDD — ARF-070: Modo Zen

## Contexto
Tema G. Barra de espaço esconde tudo exceto o background puro; apertar de novo volta ao normal. Escopo por aba (cada new-tab tem seu próprio estado).

## Critérios de aceite
- [x] Espaço (fora de inputs/textareas) alterna `zen`.
- [x] Em zen, nada além do background é renderizado (sem blur/darken/ícones/texto).
- [x] Estado é local ao componente raiz — não hidrata entre abas, nem persiste.

## Design técnico
Estado em `App.svelte` (`$state`), listener de `keydown` no `window` com guarda: ignora se `event.target` é `INPUT`/`TEXTAREA`/`contenteditable`, e chama `preventDefault()` para não rolar a página. Quando THEME (background de verdade) existir, o zen simplesmente continua escondendo tudo sobre o `BackgroundLayer`.
