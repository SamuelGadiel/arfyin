/**
 * Persistencia do collapse/expand das janelas vivas via `chrome.storage.
 * session` — session-scoped (limpa ao fechar o browser) porque `windowId`
 * so e estavel DENTRO de uma sessao do Chrome; nao faz sentido guardar isso
 * em storage.local (sobreviveria a reinicios do browser apontando pra
 * windowIds que nem existem mais). Mesmo raciocinio de persistencia que
 * `Group.collapsed` no IndexedDB, so que no storage certo para o ciclo de
 * vida certo.
 */
const STORAGE_KEY = "windowCollapsed";

let cache: Record<string, boolean> | null = null;
let loadPromise: Promise<Record<string, boolean>> | null = null;

async function load(): Promise<Record<string, boolean>> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = chrome.storage.session.get(STORAGE_KEY).then((result) => {
      cache = (result[STORAGE_KEY] as Record<string, boolean> | undefined) ?? {};
      return cache;
    });
  }
  return loadPromise;
}

export async function getWindowCollapsed(windowId: number): Promise<boolean> {
  const map = await load();
  return map[String(windowId)] ?? false;
}

export async function setWindowCollapsed(windowId: number, collapsed: boolean): Promise<void> {
  const map = await load();
  const next = { ...map, [String(windowId)]: collapsed };
  cache = next;
  await chrome.storage.session.set({ [STORAGE_KEY]: next });
}
