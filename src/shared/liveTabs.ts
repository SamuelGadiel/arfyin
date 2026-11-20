import type { LiveTab, LiveWindow } from "./types";

/**
 * Formato minimo do que usamos de `chrome.windows.Window`/`chrome.tabs.Tab`,
 * para manter esta funcao pura e testavel sem o `chrome.*` real.
 */
export interface MinimalChromeTab {
  id?: number;
  windowId: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}

export interface MinimalChromeWindow {
  id?: number;
  tabs?: MinimalChromeTab[];
}

export function toLiveWindows(windows: MinimalChromeWindow[]): LiveWindow[] {
  return windows
    .filter((w): w is MinimalChromeWindow & { id: number } => typeof w.id === "number")
    .map((w) => ({
      windowId: w.id,
      tabs: (w.tabs ?? [])
        .filter((t): t is MinimalChromeTab & { id: number } => typeof t.id === "number")
        .map(
          (t): LiveTab => ({
            chromeTabId: t.id,
            windowId: w.id,
            url: t.url ?? "",
            title: t.title ?? t.url ?? "(sem título)",
            faviconUrl: t.favIconUrl ?? null,
          }),
        ),
    }));
}
