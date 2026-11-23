export interface SavedTab {
  id: string;
  groupId: string | null;
  url: string;
  title: string;
  faviconUrl: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  order: number;
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
}

export type NewSavedTabInput = Pick<SavedTab, "url" | "title"> &
  Partial<Pick<SavedTab, "faviconUrl" | "groupId">>;

export interface LiveTab {
  chromeTabId: number;
  windowId: number;
  url: string;
  title: string;
  faviconUrl: string | null;
}

export interface LiveWindow {
  windowId: number;
  tabs: LiveTab[];
}

export interface QuickAccessItem {
  slot: number;
  url: string;
  title: string;
}

export type QuickAccessDisplayMode = "text" | "icon-text" | "icon";

export type LayoutMode = "scroll-reveal" | "coexistent" | "no-clock";

export type ClockDateFormat = "long" | "short" | "numeric" | "hidden" | "custom";

export interface ClockConfig {
  fontSize: number;
  fontWeight: number;
  color: string;
  dateFormat: ClockDateFormat;
  /** Usado so quando `dateFormat === "custom"` — ver `formatCustomDate` em Clock.svelte para os tokens suportados. */
  customDateFormat: string;
}

export type BackgroundSourceKind = "solid" | "local" | "reddit" | "unsplash";

/**
 * - `static`: uma unica imagem fixa, nunca muda sozinha (o usuario navega com
 *   ‹/› pra escolher qual, e essa escolha fica travada — nao ha botao de
 *   pausar porque ja esta sempre "pausado" por definicao).
 * - `per-tab`: cada nova aba sorteia uma imagem (comportamento padrao
 *   historico), com a opcao de pausar numa que o usuario gostou.
 * - `timed`: troca automaticamente a cada `frequencyMinutes`, de forma
 *   consistente entre abas (ver `timedStartedAt`), tambem pausavel.
 */
export type BackgroundRotationMode = "static" | "per-tab" | "timed";

export interface BackgroundConfig {
  source: BackgroundSourceKind;
  solidColor: string;
  subreddits: string[];
  unsplashTopics: string[];
  localAssetIds: string[];
  darken: number;
  blur: number;
  rotationMode: BackgroundRotationMode;
  /** So tem efeito quando `rotationMode === "timed"`. */
  frequencyMinutes: number;
  /**
   * Epoch ms de quando o ciclo `timed` atual comecou — recalculado sempre que
   * a fonte/parametros/frequencia mudam. O indice exibido em cada aba e
   * `floor((Date.now() - timedStartedAt) / (frequencyMinutes*60000)) % N`,
   * deterministico e identico entre abas sem precisar de um job central.
   */
  timedStartedAt: number;
  /**
   * Identificador estavel do candidato travado pelo botao de pausar ("lock"
   * do papel de parede), ou `null` quando nao pausado. Nunca guarda a URL
   * exibida diretamente para a fonte "local" (object URLs de blob nao
   * sobrevivem entre sessoes) — para essa fonte guarda o asset id; para
   * reddit/unsplash guarda a propria `candidate.url` (absoluta e estavel,
   * vinda da API).
   */
  pausedKey: string | null;
}

export interface TabManagerStyle {
  containerColor: string;
  containerRadius: number;
}

export interface AppConfig {
  quickAccess: QuickAccessItem[];
  quickAccessDisplayMode: QuickAccessDisplayMode;
  quickAccessShowSlot: boolean;
  /** Arredondamento (px) do container de cada item de acesso rápido. */
  quickAccessItemRadius: number;
  /** Controla a existencia do pseudo-grupo "Sem categoria". Desativar apaga todas as suas abas (ver UNGROUPED_ENABLED_SET). */
  ungroupedEnabled: boolean;
  /**
   * Pede confirmacao antes de fechar uma aba viva (unica ou em lote) ou
   * remover uma aba salva de um grupo. Nao afeta "apagar grupo" nem "fechar
   * janela inteira" — essas ja confirmam sempre, incondicionalmente, por
   * serem operacoes maiores. Default true: alinhado ao principio do projeto
   * de nunca perder dado por engano.
   */
  confirmTabClose: boolean;
  layoutMode: LayoutMode;
  clock: ClockConfig;
  background: BackgroundConfig;
  tabManagerStyle: TabManagerStyle;
  /**
   * Timestamp da ultima mutacao local (ms epoch) — usado para merge
   * last-write-wins com o Supabase (ver sync.ts: mergeConfigFromRemote).
   * `0` = nunca modificado localmente ainda (config default de uma instalacao
   * nova). `setAppConfig` sempre sobrescreve para `Date.now()`; so
   * `mergeConfigFromRemote` grava o valor vindo do servidor sem tocar.
   */
  updatedAt: number;
}

export function defaultAppConfig(): AppConfig {
  return {
    quickAccess: [],
    quickAccessDisplayMode: "text",
    quickAccessShowSlot: true,
    quickAccessItemRadius: 6,
    ungroupedEnabled: true,
    confirmTabClose: true,
    layoutMode: "coexistent",
    clock: {
      fontSize: 48,
      fontWeight: 300,
      color: "#eaeaea",
      dateFormat: "long",
      customDateFormat: "dddd, D 'de' MMMM",
    },
    background: {
      source: "solid",
      solidColor: "#121212",
      subreddits: ["EarthPorn"],
      unsplashTopics: ["nature"],
      localAssetIds: [],
      darken: 0.3,
      blur: 0,
      rotationMode: "per-tab",
      frequencyMinutes: 30,
      timedStartedAt: 0,
      pausedKey: null,
    },
    tabManagerStyle: { containerColor: "rgba(18, 18, 18, 0.55)", containerRadius: 12 },
    updatedAt: 0,
  };
}

export interface DataExport {
  schemaVersion: 1;
  exportedAt: number;
  groups: Group[];
  tabs: SavedTab[];
}

export interface ConfigExport {
  schemaVersion: 1;
  exportedAt: number;
  config: AppConfig;
}

/** Export/import unico (dados + config) — substitui os dois arquivos/botoes separados. */
export interface BackupBundle {
  schemaVersion: 1;
  exportedAt: number;
  groups: Group[];
  tabs: SavedTab[];
  config: AppConfig;
}
