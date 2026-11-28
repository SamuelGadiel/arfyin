/**
 * Cache de leitura SÍNCRONA (localStorage) da última cor/imagem de fundo
 * efetivamente exibida — existe só para eliminar o flash de fundo sólido
 * (#121212) relatado pelo usuário ao abrir uma nova aba: o valor real vem de
 * `store.config` (IPC -> IndexedDB) e, se a fonte for reddit/unsplash, de um
 * 2º round-trip (`GET_BACKGROUND_CACHE`) seguido do fetch de rede da própria
 * imagem — vários passos assíncronos antes do primeiro paint ter algo real
 * pra mostrar. `localStorage` é síncrono e lido antes de qualquer um desses
 * round-trips, servindo de palpite imediato até o valor real chegar (que
 * sempre o substitui — ver `BackgroundLayer.svelte`).
 */
const KEY = "arfyin:lastBackground";

export interface QuickBackground {
  solidColor: string;
  imageUrl: string | null;
}

export function readQuickBackground(): QuickBackground | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuickBackground;
  } catch {
    return null;
  }
}

export function writeQuickBackground(entry: QuickBackground): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // localStorage pode falhar (quota, modo privado) — e so uma otimizacao
    // de UX, nao critico; o fundo real continua vindo do fluxo normal.
  }
}
