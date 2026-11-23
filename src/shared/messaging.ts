import type {
  AppConfig,
  BackupBundle,
  Group,
  NewSavedTabInput,
  QuickAccessItem,
  SavedTab,
} from "./types";
import type { BackgroundCacheEntry, SyncStatus } from "./storage";

export interface PingMessage {
  type: "PING";
}

export interface PongMessage {
  type: "PONG";
  ts: number;
}

export function isPingMessage(message: unknown): message is PingMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "PING"
  );
}

export function buildPong(now: () => number = Date.now): PongMessage {
  return { type: "PONG", ts: now() };
}

export interface ListGroupsMessage {
  type: "LIST_GROUPS";
}

export interface CreateGroupMessage {
  type: "CREATE_GROUP";
  name: string;
}

export interface ListTabsByGroupMessage {
  type: "LIST_TABS_BY_GROUP";
  groupId: string | null;
}

export interface AddTabMessage {
  type: "ADD_TAB";
  input: NewSavedTabInput;
}

export interface RenameGroupMessage {
  type: "RENAME_GROUP";
  id: string;
  name: string;
}

export interface DeleteGroupMessage {
  type: "DELETE_GROUP";
  id: string;
}

export interface RemoveTabMessage {
  type: "REMOVE_TAB";
  id: string;
}

export interface ListUngroupedTabsMessage {
  type: "LIST_UNGROUPED_TABS";
}

export interface ListAllTabsMessage {
  type: "LIST_ALL_TABS";
}

export interface GetSyncStatusMessage {
  type: "GET_SYNC_STATUS";
}

export interface SetGroupCollapsedMessage {
  type: "SET_GROUP_COLLAPSED";
  id: string;
  collapsed: boolean;
}

export interface UpdateGroupAppearanceMessage {
  type: "UPDATE_GROUP_APPEARANCE";
  id: string;
  color?: string | null;
  icon?: string | null;
}

export interface ReorderGroupMessage {
  type: "REORDER_GROUP";
  id: string;
  newIndex: number;
}

export interface ReorderTabMessage {
  type: "REORDER_TAB";
  id: string;
  newIndex: number;
}

export interface MoveTabMessage {
  type: "MOVE_TAB";
  id: string;
  newGroupId: string | null;
  newIndex?: number;
}

export interface GetConfigMessage {
  type: "GET_CONFIG";
}

export interface SetQuickAccessMessage {
  type: "SET_QUICK_ACCESS";
  quickAccess: QuickAccessItem[];
}

export interface UpdateConfigMessage {
  type: "UPDATE_CONFIG";
  patch: Partial<AppConfig>;
}

export interface SetUngroupedEnabledMessage {
  type: "SET_UNGROUPED_ENABLED";
  enabled: boolean;
}

export interface ExportBackupMessage {
  type: "EXPORT_BACKUP";
}

export interface ImportBackupMessage {
  type: "IMPORT_BACKUP";
  data: BackupBundle;
}

export interface AddAssetMessage {
  type: "ADD_ASSET";
  blob: Blob;
}

export interface GetAssetMessage {
  type: "GET_ASSET";
  id: string;
}

export interface DeleteAssetMessage {
  type: "DELETE_ASSET";
  id: string;
}

export interface GetBackgroundCacheMessage {
  type: "GET_BACKGROUND_CACHE";
  key: string;
}

export interface SetBackgroundCacheMessage {
  type: "SET_BACKGROUND_CACHE";
  key: string;
  entry: BackgroundCacheEntry;
}

export interface BootstrapSyncMessage {
  type: "BOOTSTRAP_SYNC";
}

export type ArfyinMessage =
  | PingMessage
  | ListGroupsMessage
  | CreateGroupMessage
  | ListTabsByGroupMessage
  | AddTabMessage
  | RenameGroupMessage
  | DeleteGroupMessage
  | RemoveTabMessage
  | ListUngroupedTabsMessage
  | ListAllTabsMessage
  | GetSyncStatusMessage
  | SetGroupCollapsedMessage
  | UpdateGroupAppearanceMessage
  | ReorderGroupMessage
  | ReorderTabMessage
  | MoveTabMessage
  | GetConfigMessage
  | SetQuickAccessMessage
  | UpdateConfigMessage
  | SetUngroupedEnabledMessage
  | ExportBackupMessage
  | ImportBackupMessage
  | AddAssetMessage
  | GetAssetMessage
  | DeleteAssetMessage
  | GetBackgroundCacheMessage
  | SetBackgroundCacheMessage
  | BootstrapSyncMessage;

export type ArfyinResponse =
  | PongMessage
  | { type: "GROUPS"; groups: Group[] }
  | { type: "GROUP_CREATED"; group: Group }
  | { type: "TABS"; tabs: SavedTab[] }
  | { type: "ALL_TABS"; tabsByGroup: Record<string, SavedTab[]>; ungrouped: SavedTab[] }
  | { type: "TAB_ADDED"; tab: SavedTab; tabs: SavedTab[] }
  | { type: "GROUP_RENAMED"; group: Group | null }
  | { type: "GROUP_DELETED" }
  | { type: "TAB_REMOVED"; groupId: string | null; tabs: SavedTab[] }
  | { type: "SYNC_STATUS"; status: SyncStatus }
  | { type: "GROUP_COLLAPSED_SET"; group: Group | null }
  | { type: "GROUP_APPEARANCE_UPDATED"; group: Group | null }
  | { type: "GROUP_REORDERED"; groups: Group[] }
  | { type: "TAB_REORDERED"; groupId: string | null; tabs: SavedTab[] }
  | {
      type: "TAB_MOVED";
      sourceGroupId: string | null;
      sourceTabs: SavedTab[];
      destGroupId: string | null;
      destTabs: SavedTab[];
    }
  | { type: "CONFIG"; config: AppConfig }
  | { type: "QUICK_ACCESS_SET"; config: AppConfig }
  | { type: "CONFIG_UPDATED"; config: AppConfig }
  | { type: "UNGROUPED_ENABLED_SET"; config: AppConfig; ungrouped: SavedTab[] }
  | { type: "BACKUP_EXPORTED"; data: BackupBundle }
  | { type: "BACKUP_IMPORTED" }
  | { type: "ASSET_ADDED"; id: string }
  | { type: "ASSET"; blob: Blob | null }
  | { type: "ASSET_DELETED" }
  | { type: "BACKGROUND_CACHE"; entry: BackgroundCacheEntry | null }
  | { type: "BACKGROUND_CACHE_SET" }
  | { type: "BOOTSTRAP_SYNC_DONE" };

function hasType(message: unknown): message is { type: string } {
  return typeof message === "object" && message !== null && "type" in message;
}

// `satisfies Record<ArfyinMessage["type"], true>` trava isto no compilador: um
// tipo novo adicionado a uniao ArfyinMessage e esquecido aqui vira ERRO DE
// COMPILACAO (chave faltando), nao mais uma mensagem rejeitada em silencio em
// producao. Mesma protecao no sentido inverso (chave sobrando tambem quebra).
const MESSAGE_TYPES = {
  PING: true,
  LIST_GROUPS: true,
  CREATE_GROUP: true,
  LIST_TABS_BY_GROUP: true,
  ADD_TAB: true,
  RENAME_GROUP: true,
  DELETE_GROUP: true,
  REMOVE_TAB: true,
  LIST_UNGROUPED_TABS: true,
  LIST_ALL_TABS: true,
  GET_SYNC_STATUS: true,
  SET_GROUP_COLLAPSED: true,
  UPDATE_GROUP_APPEARANCE: true,
  REORDER_GROUP: true,
  REORDER_TAB: true,
  MOVE_TAB: true,
  GET_CONFIG: true,
  SET_QUICK_ACCESS: true,
  UPDATE_CONFIG: true,
  SET_UNGROUPED_ENABLED: true,
  EXPORT_BACKUP: true,
  IMPORT_BACKUP: true,
  ADD_ASSET: true,
  GET_ASSET: true,
  DELETE_ASSET: true,
  GET_BACKGROUND_CACHE: true,
  SET_BACKGROUND_CACHE: true,
  BOOTSTRAP_SYNC: true,
} satisfies Record<ArfyinMessage["type"], true>;

export function isArfyinMessage(message: unknown): message is ArfyinMessage {
  if (!hasType(message)) return false;
  return message.type in MESSAGE_TYPES;
}
