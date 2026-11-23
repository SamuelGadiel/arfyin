/**
 * Nomes semanticos usados nos componentes fixos do app (nunca mudam) ->
 * nome real do icone na biblioteca Hugeicons (ver iconify.ts). Isolar essa
 * indirecao aqui significa que trocar de biblioteca algum dia e so trocar os
 * valores deste mapa, sem tocar em nenhum componente.
 */
export const SEMANTIC_ICONS = {
  menu: "menu-01",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  x: "cancel-01",
  pencil: "pencil-edit-02",
  trash: "delete-02",
  "external-link": "external-link",
  droplet: "pipette",
  play: "play",
  pause: "pause",
  square: "square",
  "square-check": "checkmark-square-02",
  add: "add-01",
  globe: "globe-02",
} satisfies Record<string, string>;

export type SemanticIconName = keyof typeof SEMANTIC_ICONS;
