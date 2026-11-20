import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { defaultAppConfig, type AppConfig, type Group, type NewSavedTabInput, type SavedTab } from "./types";

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
  config: {
    key: string;
    value: AppConfig;
  };
}

const APP_CONFIG_KEY = "appConfig";

export type ArfyinDb = IDBPDatabase<ArfyinDbSchema>;

/**
 * Abre o banco local. Usa o `indexedDB` global do ambiente — no browser real é o
 * nativo; em testes, `fake-indexeddb/auto` substitui o global antes dos testes
 * rodarem (ver tests/setup.ts), então nenhum mock manual é necessário aqui.
 */
export function openArfyinDb(name = "arfyin"): Promise<ArfyinDb> {
  return openDB<ArfyinDbSchema>(name, 3, {
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
      if (oldVersion < 3) {
        db.createObjectStore("config", { keyPath: undefined });
      }
    },
  });
}

export async function getAppConfig(db: ArfyinDb): Promise<AppConfig> {
  const config = await db.get("config", APP_CONFIG_KEY);
  return config ?? defaultAppConfig();
}

export async function setAppConfig(db: ArfyinDb, config: AppConfig): Promise<void> {
  await db.put("config", config, APP_CONFIG_KEY);
}

let syncSeq = 0;

/**
 * Timestamp com resolucao extra para desempate: Date.now() sozinho (ms) pode
 * colidir entre chamadas sequenciais rapidas (comuns em testes, e possiveis em
 * producao numa rajada de mutacoes), o que quebraria a ordem causal da fila.
 */
function nextSyncOrdinal(): number {
  return Date.now() * 1000 + (syncSeq++ % 1000);
}

export async function enqueueSyncOp(
  db: ArfyinDb,
  op: Omit<SyncOp, "id" | "createdAt">,
): Promise<void> {
  const fullOp: SyncOp = { ...op, id: crypto.randomUUID(), createdAt: nextSyncOrdinal() };
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

export async function getTabById(db: ArfyinDb, id: string): Promise<SavedTab | null> {
  const stored = await db.get("tabs", id);
  return stored ? fromStoredTab(stored) : null;
}

export async function setGroupCollapsed(
  db: ArfyinDb,
  id: string,
  collapsed: boolean,
): Promise<void> {
  const group = await db.get("groups", id);
  if (!group) return;
  await db.put("groups", { ...group, collapsed, updatedAt: now() });
}

export async function updateGroupAppearance(
  db: ArfyinDb,
  id: string,
  appearance: { color?: string | null; icon?: string | null },
): Promise<void> {
  const group = await db.get("groups", id);
  if (!group) return;
  await db.put("groups", { ...group, ...appearance, updatedAt: now() });
}

export async function reorderGroup(db: ArfyinDb, groupId: string, newIndex: number): Promise<void> {
  const groups = await listGroups(db);
  const moved = groups.find((g) => g.id === groupId);
  if (!moved) return;
  const withoutMoved = groups.filter((g) => g.id !== groupId);
  const clampedIndex = Math.max(0, Math.min(newIndex, withoutMoved.length));
  withoutMoved.splice(clampedIndex, 0, moved);

  const tx = db.transaction("groups", "readwrite");
  await Promise.all(
    withoutMoved.map((g, index) => tx.objectStore("groups").put({ ...g, order: index, updatedAt: now() })),
  );
  await tx.done;
}

export async function setTabPinned(db: ArfyinDb, id: string, pinned: boolean): Promise<void> {
  const stored = await db.get("tabs", id);
  if (!stored) return;
  await db.put("tabs", { ...stored, pinned, updatedAt: now() });
}

export async function reorderTab(db: ArfyinDb, tabId: string, newIndex: number): Promise<void> {
  const stored = await db.get("tabs", tabId);
  if (!stored) return;
  const tab = fromStoredTab(stored);
  const siblings = (await listTabsByGroup(db, tab.groupId)).filter((t) => t.id !== tabId);
  const clampedIndex = Math.max(0, Math.min(newIndex, siblings.length));
  siblings.splice(clampedIndex, 0, tab);

  const tx = db.transaction("tabs", "readwrite");
  await Promise.all(
    siblings.map((t, index) =>
      tx.objectStore("tabs").put(toStoredTab({ ...t, order: index, updatedAt: t.id === tabId ? now() : t.updatedAt })),
    ),
  );
  await tx.done;
}

/**
 * Move uma aba para outro grupo (ou para fora de qualquer grupo, com
 * `newGroupId: null`), opcionalmente numa posicao especifica. Recompacta a
 * ordem tanto da lista de origem quanto da de destino (invariante: `order`
 * dentro de um grupo e sempre 0..n-1 sem buracos).
 */
export async function moveTab(
  db: ArfyinDb,
  tabId: string,
  newGroupId: string | null,
  newIndex?: number,
): Promise<void> {
  const stored = await db.get("tabs", tabId);
  if (!stored) return;
  const tab = fromStoredTab(stored);

  if (tab.groupId === newGroupId) {
    await reorderTab(db, tabId, newIndex ?? Number.MAX_SAFE_INTEGER);
    return;
  }

  const sourceSiblings = (await listTabsByGroup(db, tab.groupId)).filter((t) => t.id !== tabId);
  const destSiblings = await listTabsByGroup(db, newGroupId);
  const clampedIndex = Math.max(0, Math.min(newIndex ?? destSiblings.length, destSiblings.length));
  const moved: SavedTab = { ...tab, groupId: newGroupId, updatedAt: now() };
  destSiblings.splice(clampedIndex, 0, moved);

  const tx = db.transaction("tabs", "readwrite");
  const store = tx.objectStore("tabs");
  await Promise.all([
    ...sourceSiblings.map((t, index) => store.put(toStoredTab({ ...t, order: index }))),
    ...destSiblings.map((t, index) =>
      store.put(toStoredTab({ ...t, order: index, updatedAt: t.id === tabId ? now() : t.updatedAt })),
    ),
  ]);
  await tx.done;
}
