export interface SavedTab {
  id: string;
  groupId: string | null;
  url: string;
  title: string;
  faviconUrl: string | null;
  order: number;
  pinned: boolean;
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
  Partial<Pick<SavedTab, "faviconUrl" | "groupId" | "pinned">>;

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

export type LayoutMode = "scroll-reveal" | "coexistent" | "no-clock";

export interface ClockConfig {
  format24h: boolean;
  fontSize: number;
  color: string;
}

export type BackgroundSourceKind = "solid" | "local" | "reddit" | "unsplash";

export interface BackgroundConfig {
  source: BackgroundSourceKind;
  solidColor: string;
  subreddits: string[];
  unsplashTopics: string[];
  localAssetIds: string[];
  darken: number;
  blur: number;
  frequencyMinutes: number;
}

export interface AppConfig {
  quickAccess: QuickAccessItem[];
  layoutMode: LayoutMode;
  clock: ClockConfig;
  background: BackgroundConfig;
}

export function defaultAppConfig(): AppConfig {
  return {
    quickAccess: [],
    layoutMode: "coexistent",
    clock: { format24h: true, fontSize: 48, color: "#eaeaea" },
    background: {
      source: "solid",
      solidColor: "#121212",
      subreddits: ["EarthPorn"],
      unsplashTopics: ["nature"],
      localAssetIds: [],
      darken: 0.3,
      blur: 0,
      frequencyMinutes: 0,
    },
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
