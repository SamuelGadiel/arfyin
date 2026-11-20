export type QuickAccessAction =
  | { type: "open-one"; slot: number; focus: boolean }
  | { type: "open-all"; focus: boolean }
  | { type: "none" };

/**
 * Resolve qual acao tomar dado o `event.code` de uma tecla e se um modificador
 * (Cmd no Mac / Ctrl em outros) estava pressionado. Funcao pura — sem
 * dependencia de DOM/chrome.* — para ser testavel diretamente.
 */
export function resolveQuickAccessKey(code: string, modifierPressed: boolean): QuickAccessAction {
  const match = /^Digit([0-9])$/.exec(code);
  if (!match) return { type: "none" };

  const digit = Number(match[1]);
  const focus = !modifierPressed;

  if (digit === 0) return { type: "open-all", focus };
  return { type: "open-one", slot: digit, focus };
}
