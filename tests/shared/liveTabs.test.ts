import { describe, expect, it } from "vitest";
import { toLiveWindows } from "@/shared/liveTabs";

describe("toLiveWindows", () => {
  it("converte janelas/abas do chrome.windows.getAll para LiveWindow[]", () => {
    const result = toLiveWindows([
      {
        id: 1,
        tabs: [
          { id: 10, windowId: 1, url: "https://a.com", title: "A", favIconUrl: "a.ico" },
          { id: 11, windowId: 1, url: "https://b.com", title: "B" },
        ],
      },
      { id: 2, tabs: [] },
    ]);

    expect(result).toEqual([
      {
        windowId: 1,
        tabs: [
          { chromeTabId: 10, windowId: 1, url: "https://a.com", title: "A", faviconUrl: "a.ico" },
          { chromeTabId: 11, windowId: 1, url: "https://b.com", title: "B", faviconUrl: null },
        ],
      },
      { windowId: 2, tabs: [] },
    ]);
  });

  it("ignora janelas/abas sem id e usa a url como titulo de fallback", () => {
    const result = toLiveWindows([
      { tabs: [{ id: 1, windowId: 99, url: "https://sem-titulo.com" }] },
      { id: 3, tabs: [{ windowId: 3, url: "https://sem-id.com" }] },
    ]);

    expect(result).toEqual([{ windowId: 3, tabs: [] }]);
  });

  it("lista vazia retorna lista vazia", () => {
    expect(toLiveWindows([])).toEqual([]);
  });
});
