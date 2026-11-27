import { describe, expect, it } from "vitest";
import { computeLiveDropIndex } from "@/newtab/lib/liveTabDrop";

function tabs(...chromeTabIds: number[]) {
  return chromeTabIds.map((chromeTabId) => ({ chromeTabId }));
}

describe("computeLiveDropIndex", () => {
  it("cross-window puro: nenhuma aba arrastada pertence a esta janela, indice fica intacto", () => {
    const destTabs = tabs(10, 20, 30);
    expect(computeLiveDropIndex(destTabs, 0, [999])).toBe(0);
    expect(computeLiveDropIndex(destTabs, 2, [999])).toBe(2);
    expect(computeLiveDropIndex(destTabs, 3, [999])).toBe(3);
  });

  it("reorder same-window de 1 aba: soltar DEPOIS da posicao original desconta 1", () => {
    const destTabs = tabs(10, 20, 30, 40);
    // aba 10 esta na posicao 0; soltar no gap index=3 (entre 30 e 40) deve
    // descontar a remocao da posicao 0, caindo em index 2.
    expect(computeLiveDropIndex(destTabs, 3, [10])).toBe(2);
  });

  it("reorder same-window de 1 aba: soltar ANTES da posicao original nao desconta nada", () => {
    const destTabs = tabs(10, 20, 30, 40);
    // aba 40 esta na posicao 3; soltar no gap index=0 (antes de tudo) nao tem
    // nenhuma aba arrastada antes do gap, entao nao desconta nada.
    expect(computeLiveDropIndex(destTabs, 0, [40])).toBe(0);
  });

  it("soltar exatamente na posicao atual (no-op): indice final nao muda", () => {
    const destTabs = tabs(10, 20, 30);
    // aba 20 esta na posicao 1; soltar no gap index=1 (imediatamente antes
    // dela mesma) nao conta nenhuma remocao antes do gap.
    expect(computeLiveDropIndex(destTabs, 1, [20])).toBe(1);
  });

  it("lote de N abas com posicoes intercaladas", () => {
    const destTabs = tabs(10, 20, 30, 40, 50);
    // abas 10 (pos 0) e 30 (pos 2) arrastadas juntas; soltar no gap index=4
    // (entre 40 e 50) desconta as 2 que estao antes do gap.
    expect(computeLiveDropIndex(destTabs, 4, [10, 30])).toBe(2);
  });

  it("lote misto: parte na janela de destino, parte de fora", () => {
    const destTabs = tabs(10, 20, 30, 40);
    // aba 10 (pos 0, desta janela) e aba 999 (de outra janela) arrastadas
    // juntas; soltar no gap index=3 so desconta a que de fato esta aqui.
    expect(computeLiveDropIndex(destTabs, 3, [10, 999])).toBe(2);
  });

  it("janela vazia: unico gap possivel (index 0) sempre retorna 0", () => {
    expect(computeLiveDropIndex([], 0, [10])).toBe(0);
  });
});
