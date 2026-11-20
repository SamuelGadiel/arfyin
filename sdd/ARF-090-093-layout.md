# SDD — ARF-090 a ARF-093: modos de layout da new-tab

## Contexto
Tema I. Três variações de como relógio + gestão de abas coexistem na tela, configurável pelo usuário.

## Escopo
Introduz `layoutMode` (`"scroll-reveal" | "coexistent" | "no-clock"`) e um `Clock` básico (necessário para os 3 modos fazerem sentido — customização completa do relógio fica para o epic THEME, aqui só o essencial: hora+data, 24h toggle).

## Critérios de aceite
- [x] `no-clock`: só a gestão de abas (comportamento atual antes deste card).
- [x] `coexistent`: relógio fixo no topo + gestão de abas abaixo, sempre visível, sem scroll especial.
- [x] `scroll-reveal`: relógio centralizado ocupando a tela inteira; primeiro "tick" de scroll (roda do mouse) ou seta para baixo rola suavemente até a seção de abas.
- [x] Configurável via `UPDATE_CONFIG` (mensagem genérica que faz merge parcial no `AppConfig`, reaproveitável por THEME depois sem precisar de uma mensagem nova por campo).

## Design técnico
- `Clock.svelte`: `setInterval` de 1s, `Intl.DateTimeFormat` para hora/data respeitando fuso do sistema (requisito do usuário: "ou talvez seja melhor pegar do computador mesmo").
- `scroll-reveal` implementado com um listener de `wheel`/`keydown(ArrowDown)` que, na primeira ocorrência, faz `scrollIntoView({behavior:"smooth"})` na seção de abas — não precisa de biblioteca de scroll.
- Blur/darken na transição do `scroll-reveal` fica registrado como ajuste fino de THEME (não há ainda background de imagem para borrar) — a estrutura de layout já está pronta para receber isso.

## Testes previstos
Sem lógica pura isolada relevante além do que já existe (merge de config é trivial). Validação por teste manual no Chrome real, como os demais cards de UI desta sessão.
