import type { LiveTab } from "@/shared/types";

/**
 * Modo de selecao multipla para abas vivas (coluna "Abas abertas") — permite
 * arrastar varias abas de uma vez para um grupo numa unica operacao de drag.
 * Guarda a aba inteira (nao so o chromeTabId) porque o drag payload em lote
 * precisa de url/title/favicon de CADA selecionada, nao so da que iniciou o
 * drag. Estado efemero (nao persistido): sempre comeca desligado a cada
 * reload, igual ao collapse de "Sem categoria".
 */
class LiveSelectionState {
  active = $state(false);
  private map: Map<number, LiveTab> = $state(new Map());

  selected = $derived(Array.from(this.map.values()));

  enable(): void {
    this.active = true;
    this.map = new Map();
  }

  disable(): void {
    this.active = false;
    this.map = new Map();
  }

  toggle(tab: LiveTab): void {
    const next = new Map(this.map);
    if (next.has(tab.chromeTabId)) next.delete(tab.chromeTabId);
    else next.set(tab.chromeTabId, tab);
    this.map = next;
  }

  isSelected(chromeTabId: number): boolean {
    return this.map.has(chromeTabId);
  }
}

export const liveSelectionState = new LiveSelectionState();
