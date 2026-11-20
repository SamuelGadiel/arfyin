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
  | GetSyncStatusMessage;

export type ArfyinResponse =
  | PongMessage
  | { type: "GROUPS"; groups: Group[] }
  | { type: "GROUP_CREATED"; group: Group }
  | { type: "TABS"; tabs: SavedTab[] }
  | { type: "TAB_ADDED"; tab: SavedTab }
  | { type: "GROUP_RENAMED" }
  | { type: "GROUP_DELETED" }
  | { type: "TAB_REMOVED" }
  | { type: "SYNC_STATUS"; status: SyncStatus };

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
  ].includes(message.type);
}
