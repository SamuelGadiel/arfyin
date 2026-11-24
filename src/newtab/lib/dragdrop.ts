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

/** Varias abas vivas selecionadas (modo de selecao multipla) arrastadas juntas numa unica operacao. */
export interface LiveTabsBatchDragPayload {
  kind: "live-tabs-batch";
  tabs: Omit<LiveTabDragPayload, "kind">[];
}

export type DragPayload = SavedTabDragPayload | LiveTabDragPayload | LiveWindowDragPayload | LiveTabsBatchDragPayload;

export function setDragPayload(event: DragEvent, payload: DragPayload): void {
  event.dataTransfer?.setData(MIME_TYPE, JSON.stringify(payload));
  // "move" restringia o drag a UM unico efeito nativo. No macOS, segurar uma
  // tecla modificadora durante o arraste (Option, Command, Control) faz o SO
  // tentar aplicar um dropEffect diferente (tipicamente "copy") — se esse
  // efeito nao estiver entre os permitidos aqui, o Chrome rejeita o drop
  // silenciosamente (nenhum evento 'drop' chega a disparar no DOM, o item so
  // "volta" pro lugar). Reproduz exatamente o relato do usuario: sem tecla
  // funciona (dropEffect default bate com "move"), com qualquer tecla falha.
  // "all" permite copy/move/link e deixa de depender de qual tecla o SO
  // mapeia pra qual efeito — o app ja le o estado real da tecla direto do
  // evento (`event.altKey`/`metaKey`) no handler de drop, nunca do dropEffect.
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "all";
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
