import type { LiveTab } from "@/shared/types";

/**
 * `destWindowTabs`: lista atual (chrome.tabs real order) das abas da janela de
 * destino, ANTES da remoção. `gapIndex`: posição do gap onde foi solto (0 =
 * antes da 1a aba, length = depois da ultima). `draggedChromeTabIds`: os
 * chromeTabId(s) sendo movidos (1 ou N, podem ou nao pertencer a esta janela).
 *
 * Generaliza o ajuste de indice ja usado em GroupDropGap (`draggedPos < index
 * ? index - 1 : index`) para N abas e para o caso em que nenhuma delas esta
 * nesta janela (cross-window puro): cada aba arrastada que JA ESTA nesta
 * janela e aparece ANTES do gap sera removida antes da reinsercao, entao o
 * indice final cai em 1 pra cada uma. Abas que nao pertencem a esta janela
 * nao afetam a conta.
 */
export function computeLiveDropIndex(
  destWindowTabs: Pick<LiveTab, "chromeTabId">[],
  gapIndex: number,
  draggedChromeTabIds: readonly number[],
): number {
  const dragged = new Set(draggedChromeTabIds);
  let removedBefore = 0;
  for (let i = 0; i < gapIndex; i++) {
    const t = destWindowTabs[i];
    if (t && dragged.has(t.chromeTabId)) removedBefore++;
  }
  return gapIndex - removedBefore;
}
