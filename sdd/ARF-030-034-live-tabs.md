# SDD — ARF-030 a ARF-034: abas e janelas abertas ao vivo

## Contexto
Tema C do `feature_ideas.md` — o diferencial mais citado pelo usuário ("quero ver todas as abas abertas, organizadas por janela, e poder arrastar pra um grupo"). Ver ADR-003: já estava previsto desde o scaffolding inicial usar uma `Port` de longa duração para isso, não polling.

## Escopo
Monitoramento em tempo real de tabs/windows no service worker (C1), broadcast via `chrome.runtime.Port` para todas as new-tabs abertas, UI mostrando abas abertas agrupadas por janela (C1), drag de aba viva → grupo salvando sem fechar por padrão, fechando com Option/Alt pressionado no momento do drop (C2), mesmo comportamento para arrastar a janela inteira (C3).

## Critérios de aceite
- [ ] Background escuta `chrome.tabs.onCreated/onRemoved/onUpdated` e `chrome.windows.onCreated/onRemoved`, e a cada evento reconsulta `chrome.windows.getAll({populate:true})` e faz broadcast para as portas conectadas.
- [ ] New-tab abre uma `Port` ao montar, recebe atualizações sem polling.
- [ ] UI mostra cada janela como uma seção com suas abas (favicon+título).
- [ ] Arrastar uma aba viva para um grupo chama `ADD_TAB`; **sem** Option/Alt no drop, a aba original continua aberta; **com** Option/Alt, a aba original é fechada (`chrome.tabs.remove`) após salvar.
- [ ] Mesmo comportamento arrastando o cabeçalho de uma janela inteira (todas as abas daquela janela).
- [ ] Validado no Chrome real.

## Design técnico
- Tipos novos em `shared/types.ts`: `LiveTab`, `LiveWindow`.
- `dragdrop.ts` ganha dois payloads novos (`live-tab`, `live-window`), mesma `DragPayload` union.
- `GroupItem.handleDrop` passa a reconhecer os 3 kinds (`saved-tab` já existia, `live-tab`, `live-window` novos).
- Fechar a aba original é responsabilidade da **UI** (que tem `event.altKey` disponível no evento nativo de drop), não do background — o background só expõe `ADD_TAB`; fechar é uma chamada direta `chrome.tabs.remove`/`chrome.windows.remove` já disponível na new-tab (permissão `tabs` já concedida).

## Testes previstos
Lógica de formatação/agrupamento de `chrome.windows.getAll` em `LiveWindow[]` isolada numa função pura testável sem `chrome.*` real.
