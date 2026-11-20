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

export interface AppConfig {
  quickAccess: QuickAccessItem[];
}

export function defaultAppConfig(): AppConfig {
  return { quickAccess: [] };
}
