import { toLiveWindows } from "@/shared/liveTabs";
import type { LiveWindow } from "@/shared/types";

export const LIVE_WINDOWS_PORT_NAME = "live-windows";

const ports = new Set<chrome.runtime.Port>();

async function currentLiveWindows(): Promise<LiveWindow[]> {
  const windows = await chrome.windows.getAll({ populate: true });
  return toLiveWindows(windows);
}

async function broadcast(): Promise<void> {
  const liveWindows = await currentLiveWindows();
  for (const port of ports) {
    port.postMessage({ type: "LIVE_WINDOWS", windows: liveWindows });
  }
}

export function registerLiveTabsBroadcast(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== LIVE_WINDOWS_PORT_NAME) return;
    ports.add(port);
    currentLiveWindows().then((windows) => {
      port.postMessage({ type: "LIVE_WINDOWS", windows });
    });
    port.onDisconnect.addListener(() => ports.delete(port));
  });

  chrome.tabs.onCreated.addListener(() => void broadcast());
  chrome.tabs.onRemoved.addListener(() => void broadcast());
  chrome.tabs.onUpdated.addListener(() => void broadcast());
  chrome.tabs.onAttached.addListener(() => void broadcast());
  chrome.tabs.onDetached.addListener(() => void broadcast());
  // Reorder PURO dentro da mesma janela (chrome.tabs.move com o mesmo
  // windowId) só dispara `onMoved` — `onAttached`/`onDetached` só ocorrem em
  // moves cross-window. Faltava este listener (achado na validação ao vivo
  // do ARF-165/166/167): sem ele, a UI não se re-renderizava sozinha após um
  // reorder dentro da mesma janela, exigindo reload manual.
  chrome.tabs.onMoved.addListener(() => void broadcast());
  chrome.windows.onCreated.addListener(() => void broadcast());
  chrome.windows.onRemoved.addListener(() => void broadcast());
}
