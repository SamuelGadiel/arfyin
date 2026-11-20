import type { Group, NewSavedTabInput, SavedTab } from "./types";
import type { SyncStatus } from "./storage";

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

export interface SetTabPinnedMessage {
  type: "SET_TAB_PINNED";
  id: string;
  pinned: boolean;
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
  | GetSyncStatusMessage
  | SetGroupCollapsedMessage
  | UpdateGroupAppearanceMessage
  | ReorderGroupMessage
  | SetTabPinnedMessage
  | ReorderTabMessage
  | MoveTabMessage;

export type ArfyinResponse =
  | PongMessage
  | { type: "GROUPS"; groups: Group[] }
  | { type: "GROUP_CREATED"; group: Group }
  | { type: "TABS"; tabs: SavedTab[] }
  | { type: "TAB_ADDED"; tab: SavedTab }
  | { type: "GROUP_RENAMED" }
  | { type: "GROUP_DELETED" }
  | { type: "TAB_REMOVED" }
  | { type: "SYNC_STATUS"; status: SyncStatus }
  | { type: "GROUP_COLLAPSED_SET" }
  | { type: "GROUP_APPEARANCE_UPDATED" }
  | { type: "GROUP_REORDERED" }
  | { type: "TAB_PINNED_SET" }
  | { type: "TAB_REORDERED" }
  | { type: "TAB_MOVED" };

function hasType(message: unknown): message is { type: string } {
  return typeof message === "object" && message !== null && "type" in message;
}

export function isArfyinMessage(message: unknown): message is ArfyinMessage {
  if (!hasType(message)) return false;
  return [
    "PING",
    "LIST_GROUPS",
    "CREATE_GROUP",
    "LIST_TABS_BY_GROUP",
    "ADD_TAB",
    "RENAME_GROUP",
    "DELETE_GROUP",
    "REMOVE_TAB",
    "LIST_UNGROUPED_TABS",
    "GET_SYNC_STATUS",
    "SET_GROUP_COLLAPSED",
    "UPDATE_GROUP_APPEARANCE",
    "REORDER_GROUP",
    "SET_TAB_PINNED",
    "REORDER_TAB",
    "MOVE_TAB",
  ].includes(message.type);
}
