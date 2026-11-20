import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Group, NewSavedTabInput, SavedTab } from "./types";

/**
 * IndexedDB não aceita `null` como chave de índice válida. Internamente guardamos
 * "aba sem grupo" com este sentinel de string, e convertemos de/para `null` na
 * borda pública desta camada (ver `toStoredTab`/`fromStoredTab`).
 */
const UNGROUPED = "__ungrouped__";

type StoredTab = Omit<SavedTab, "groupId"> & { groupId: string };

function toStoredTab(tab: SavedTab): StoredTab {
  return { ...tab, groupId: tab.groupId ?? UNGROUPED };
}

function fromStoredTab(record: StoredTab): SavedTab {
  return { ...record, groupId: record.groupId === UNGROUPED ? null : record.groupId };
}

export interface SyncOp {
  id: string;
  table: "groups" | "tabs";
  op: "upsert" | "delete";
  entityId: string;
  payload?: Group | SavedTab;
  createdAt: number;
}

export type SyncState = "idle" | "syncing" | "unreachable";

export interface SyncStatus {
  state: SyncState;
  lastError: string | null;
  lastSuccessAt: number | null;
}

const SYNC_STATUS_KEY = "syncStatus";

interface ArfyinDbSchema extends DBSchema {
  groups: {
    key: string;
    value: Group;
  };
  tabs: {
    key: string;
    value: StoredTab;
    indexes: { groupId: string };
  };
  sync_queue: {
    key: string;
    value: SyncOp;
  };
  meta: {
    key: string;
    value: SyncStatus;
  };
}

export type ArfyinDb = IDBPDatabase<ArfyinDbSchema>;

/**
 * Abre o banco local. Usa o `indexedDB` global do ambiente — no browser real é o
 * nativo; em testes, `fake-indexeddb/auto` substitui o global antes dos testes
 * rodarem (ver tests/setup.ts), então nenhum mock manual é necessário aqui.
 */
export function openArfyinDb(name = "arfyin"): Promise<ArfyinDb> {
  return openDB<ArfyinDbSchema>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("groups", { keyPath: "id" });
        const tabs = db.createObjectStore("tabs", { keyPath: "id" });
        tabs.createIndex("groupId", "groupId");
      }
      if (oldVersion < 2) {
        db.createObjectStore("sync_queue", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: undefined });
      }
    },
  });
}

export async function enqueueSyncOp(
  db: ArfyinDb,
  op: Omit<SyncOp, "id" | "createdAt">,
): Promise<void> {
  const fullOp: SyncOp = { ...op, id: crypto.randomUUID(), createdAt: now() };
  await db.put("sync_queue", fullOp);
}

export async function listSyncQueue(db: ArfyinDb): Promise<SyncOp[]> {
  const ops = await db.getAll("sync_queue");
  return ops.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeSyncOp(db: ArfyinDb, id: string): Promise<void> {
  await db.delete("sync_queue", id);
}

export async function getSyncStatus(db: ArfyinDb): Promise<SyncStatus> {
  const status = await db.get("meta", SYNC_STATUS_KEY);
  return status ?? { state: "idle", lastError: null, lastSuccessAt: null };
}

export async function setSyncStatus(db: ArfyinDb, status: SyncStatus): Promise<void> {
  await db.put("meta", status, SYNC_STATUS_KEY);
}

function now(): number {
  return Date.now();
}

export async function createGroup(db: ArfyinDb, name: string): Promise<Group> {
  const existing = await db.getAll("groups");
  const group: Group = {
    id: crypto.randomUUID(),
    name,
    color: null,
    icon: null,
    order: existing.length,
    collapsed: false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.put("groups", group);
  return group;
}

export async function listGroups(db: ArfyinDb): Promise<Group[]> {
  const groups = await db.getAll("groups");
  return groups.sort((a, b) => a.order - b.order);
}

export async function renameGroup(db: ArfyinDb, id: string, name: string): Promise<void> {
  const group = await db.get("groups", id);
  if (!group) return;
  await db.put("groups", { ...group, name, updatedAt: now() });
}

export async function deleteGroup(db: ArfyinDb, id: string): Promise<void> {
  const tabsInGroup = await db.getAllFromIndex("tabs", "groupId", id);
  const tx = db.transaction(["groups", "tabs"], "readwrite");
  await Promise.all([
    tx.objectStore("groups").delete(id),
    ...tabsInGroup.map((tab) => tx.objectStore("tabs").delete(tab.id)),
  ]);
  await tx.done;
}

export async function addTabToGroup(
  db: ArfyinDb,
  input: NewSavedTabInput,
): Promise<SavedTab> {
  const groupId = input.groupId ?? null;
  const indexKey = groupId ?? UNGROUPED;
  const siblingCount = (await db.getAllFromIndex("tabs", "groupId", indexKey)).length;
  const tab: SavedTab = {
    id: crypto.randomUUID(),
    groupId,
    url: input.url,
    title: input.title,
    faviconUrl: input.faviconUrl ?? null,
    order: siblingCount,
    pinned: input.pinned ?? false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.put("tabs", toStoredTab(tab));
  return tab;
}

export async function removeTab(db: ArfyinDb, id: string): Promise<void> {
  await db.delete("tabs", id);
}

export async function listTabsByGroup(
  db: ArfyinDb,
  groupId: string | null,
): Promise<SavedTab[]> {
  const indexKey = groupId ?? UNGROUPED;
  const stored = await db.getAllFromIndex("tabs", "groupId", indexKey);
  return stored.map(fromStoredTab).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.order - b.order;
  });
}

export function listUngroupedTabs(db: ArfyinDb): Promise<SavedTab[]> {
  return listTabsByGroup(db, null);
}
