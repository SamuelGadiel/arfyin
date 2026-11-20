/**
 * Protocolo simples de drag-and-drop nativo (HTML5 DnD) usado entre TabItem,
 * GroupItem e as listas de abas ao vivo (LIVE, card futuro). Um unico MIME
 * type custom carrega um payload JSON tipado.
 */
const MIME_TYPE = "application/x-arfyin-drag";

export interface SavedTabDragPayload {
  kind: "saved-tab";
  tabId: string;
  sourceGroupId: string | null;
}

export interface LiveTabDragPayload {
  kind: "live-tab";
  chromeTabId: number;
  windowId: number;
  url: string;
  title: string;
  faviconUrl: string | null;
}

export interface LiveWindowDragPayload {
  kind: "live-window";
  windowId: number;
  tabs: Omit<LiveTabDragPayload, "kind">[];
}

export type DragPayload = SavedTabDragPayload | LiveTabDragPayload | LiveWindowDragPayload;

export function setDragPayload(event: DragEvent, payload: DragPayload): void {
  event.dataTransfer?.setData(MIME_TYPE, JSON.stringify(payload));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

export function readDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer?.getData(MIME_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
