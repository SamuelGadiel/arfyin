/**
 * Durante o arraste de aba(s) viva(s) (unica ou lote selecionado), os
 * `LiveTabDropGap` precisam saber que esse e o tipo de drag em andamento para
 * decidir se devem reagir (`dragenter`/`dragover`) — `dataTransfer.getData()`
 * so pode ser lido no evento `drop` (restricao do navegador), entao o gap nao
 * pode decidir "devo iluminar?" lendo o payload antes disso. Mesmo motivo de
 * existir de `groupDragState`.
 */
export const liveTabDragState = $state<{ draggingTabIds: number[] | null }>({
  draggingTabIds: null,
});
