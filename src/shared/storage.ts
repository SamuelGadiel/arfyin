import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  defaultAppConfig,
  type AppConfig,
  type BackupBundle,
  type ConfigExport,
  type DataExport,
  type Group,
  type NewSavedTabInput,
  type SavedTab,
} from "./types";
import type { BackgroundAttribution, BackgroundCandidate } from "./backgroundSource";

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
  table: "groups" | "tabs" | "config";
  op: "upsert" | "delete";
  entityId: string;
  payload?: Group | SavedTab | AppConfig;
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
  assets: {
    key: string;
    value: Blob;
  };
  background_cache: {
    key: string;
    value: BackgroundCacheEntry;
  };
  background_prefetch: {
    key: string;
    value: BackgroundPrefetchItem;
    indexes: { specKey: string };
  };
}

export interface BackgroundCacheEntry {
  candidates: BackgroundCandidate[];
  fetchedAt: number;
}

/**
 * Item da fila de imagens de fundo PRE-BAIXADAS (blob real, nao so URL) para
 * reddit/unsplash no modo "per-tab" — pedido explicito do usuario apos o
 * fluxo anterior (reaplicar a ultima imagem via localStorage) causar flashes
 * de imagem errada: aqui cada aba consome um item ja pronto da fila (blob em
 * `assets`, ver `addAsset`/`getAsset`), nunca reaplica o que outra aba ja
 * usou. `specKey` = mesma assinatura de fonte/parametros usada em
 * `background_cache`, para isolar filas de configuracoes diferentes.
 */
export interface BackgroundPrefetchItem {
  id: string;
  specKey: string;
  order: number;
  /** URL original (reddit/unsplash) de onde o blob veio — usada por `pause()` pra travar nessa imagem, igual ao fluxo sem prefetch. */
  sourceUrl: string;
  attribution?: BackgroundAttribution;
}

const APP_CONFIG_KEY = "appConfig";

export type ArfyinDb = IDBPDatabase<ArfyinDbSchema>;

/**
 * Abre o banco local. Usa o `indexedDB` global do ambiente — no browser real é o
 * nativo; em testes, `fake-indexeddb/auto` substitui o global antes dos testes
 * rodarem (ver tests/setup.ts), então nenhum mock manual é necessário aqui.
 */
export function openArfyinDb(name = "arfyin"): Promise<ArfyinDb> {
  return openDB<ArfyinDbSchema>(name, 6, {
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
      if (oldVersion < 4) {
        db.createObjectStore("assets", { keyPath: undefined });
      }
      if (oldVersion < 5) {
        db.createObjectStore("background_cache", { keyPath: undefined });
      }
      if (oldVersion < 6) {
        const prefetch = db.createObjectStore("background_prefetch", { keyPath: "id" });
        prefetch.createIndex("specKey", "specKey");
      }
    },
  });
}

export async function addAsset(db: ArfyinDb, blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await db.put("assets", blob, id);
  return id;
}

export async function getAsset(db: ArfyinDb, id: string): Promise<Blob | null> {
  const blob = await db.get("assets", id);
  return blob ?? null;
}

export async function deleteAsset(db: ArfyinDb, id: string): Promise<void> {
  await db.delete("assets", id);
}

export async function getAppConfig(db: ArfyinDb): Promise<AppConfig> {
  const config = await db.get("config", APP_CONFIG_KEY);
  const defaults = defaultAppConfig();
  // merge defensivo: registros gravados antes de um campo novo existir nao
  // devem quebrar leituras futuras (ex.: layoutMode/clock adicionados depois
  // de quickAccess). Precisa ser aninhado em clock/background/tabManagerStyle
  // — um spread raso substituiria o objeto inteiro e descartaria os defaults
  // dos campos novos (ex.: um usuario real que ja tinha `clock` salvo antes
  // de `fontWeight` existir ficaria com `fontWeight: undefined`, nao com o
  // default).
  return {
    ...defaults,
    ...config,
    clock: { ...defaults.clock, ...config?.clock },
    background: { ...defaults.background, ...config?.background },
    tabManagerStyle: { ...defaults.tabManagerStyle, ...config?.tabManagerStyle },
  };
}

export async function setAppConfig(db: ArfyinDb, config: AppConfig): Promise<void> {
  await db.put("config", { ...config, updatedAt: now() }, APP_CONFIG_KEY);
}

/**
 * Mescla a config vinda do Supabase (pull) — mesmo padrao last-write-wins de
 * mergeGroupFromRemote/mergeTabFromRemote. Ao contrario de `setAppConfig`
 * (uso normal, sempre atualiza `updatedAt` para agora), esta grava o valor
 * de `updatedAt` exatamente como veio do servidor — senao a comparacao de
 * merge perderia sentido (o local pareceria sempre "mais novo").
 */
export async function mergeConfigFromRemote(db: ArfyinDb, remote: AppConfig): Promise<void> {
  const local = await getAppConfig(db);
  if (remote.updatedAt > local.updatedAt) {
    await db.put("config", remote, APP_CONFIG_KEY);
  }
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

/**
 * Cache de candidatos de background (reddit/unsplash), evitando um round-trip de
 * rede a cada new-tab aberta — chave = assinatura da fonte configurada (ver
 * `bgKey` em BackgroundLayer.svelte). TTL e staleness ficam por conta do chamador.
 */
export async function getBackgroundCache(db: ArfyinDb, key: string): Promise<BackgroundCacheEntry | null> {
  const entry = await db.get("background_cache", key);
  return entry ?? null;
}

/**
 * Adiciona um item ao FIM da fila de pre-fetch daquele `specKey`. O blob vai
 * na tabela `assets` ja existente (reaproveita addAsset/getAsset/deleteAsset
 * — evita duplicar a infraestrutura de blob grande).
 */
export async function enqueueBackgroundPrefetch(
  db: ArfyinDb,
  specKey: string,
  blob: Blob,
  sourceUrl: string,
  attribution?: BackgroundAttribution,
): Promise<string> {
  const id = await addAsset(db, blob);
  const existing = await db.getAllFromIndex("background_prefetch", "specKey", specKey);
  const maxOrder = existing.reduce((m, it) => Math.max(m, it.order), -1);
  await db.put("background_prefetch", { id, specKey, order: maxOrder + 1, sourceUrl, attribution });
  return id;
}

/**
 * Remove e retorna o item MAIS ANTIGO (menor `order`) da fila daquele
 * `specKey` — leitura+remocao numa UNICA transacao IndexedDB (readwrite),
 * atomica em relacao a chamadas concorrentes (duas abas abrindo ao mesmo
 * tempo nao podem consumir o mesmo item — IndexedDB serializa transacoes
 * readwrite na mesma object store). NAO remove o blob associado em `assets`
 * — quem chama decide (normalmente le o blob e so entao remove, ver
 * `src/background/backgroundPrefetch.ts`).
 */
export async function popBackgroundPrefetch(db: ArfyinDb, specKey: string): Promise<BackgroundPrefetchItem | null> {
  const tx = db.transaction("background_prefetch", "readwrite");
  const index = tx.store.index("specKey");
  let cursor = await index.openCursor(IDBKeyRange.only(specKey));
  let best: BackgroundPrefetchItem | null = null;
  while (cursor) {
    if (!best || cursor.value.order < best.order) best = cursor.value;
    cursor = await cursor.continue();
  }
  if (best) await tx.store.delete(best.id);
  await tx.done;
  return best;
}

export async function countBackgroundPrefetch(db: ArfyinDb, specKey: string): Promise<number> {
  return (await db.getAllFromIndex("background_prefetch", "specKey", specKey)).length;
}

/**
 * Limpa itens de filas de OUTRAS configuracoes (specKey diferente) — evita
 * acumular lixo indefinidamente quando o usuario troca de fonte/subreddits;
 * libera tambem o blob associado em `assets`.
 */
export async function clearBackgroundPrefetchExcept(db: ArfyinDb, keepSpecKey: string): Promise<void> {
  const all = await db.getAll("background_prefetch");
  for (const item of all) {
    if (item.specKey !== keepSpecKey) {
      await db.delete("background_prefetch", item.id);
      await deleteAsset(db, item.id);
    }
  }
}

export async function setBackgroundCache(db: ArfyinDb, key: string, entry: BackgroundCacheEntry): Promise<void> {
  await db.put("background_cache", entry, key);
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
    createdAt: now(),
    updatedAt: now(),
  };
  await db.put("tabs", toStoredTab(tab));
  return tab;
}

export async function removeTab(db: ArfyinDb, id: string): Promise<void> {
  const stored = await db.get("tabs", id);
  if (!stored) return;
  const tab = fromStoredTab(stored);
  // Recompacta os irmaos remanescentes (invariante: order e sempre 0..n-1 sem
  // buracos, igual reorderTab/moveTab ja fazem) — sem isso, addTabToGroup
  // (que usa a CONTAGEM de irmaos como novo order) podia colidir com o order
  // de uma aba existente depois de remover uma do meio da lista.
  const siblings = (await listTabsByGroup(db, tab.groupId)).filter((t) => t.id !== id);

  const tx = db.transaction("tabs", "readwrite");
  await Promise.all([
    tx.objectStore("tabs").delete(id),
    ...siblings.map((t, index) => tx.objectStore("tabs").put(toStoredTab({ ...t, order: index }))),
  ]);
  await tx.done;
}

/**
 * Mescla um grupo vindo do Supabase (pull) no IndexedDB local — usado no
 * bootstrap de sync apos login (ver sync.ts: pullAndMerge). Last-write-wins
 * por `updatedAt`: so sobrescreve a copia local se o registro remoto for mais
 * recente (ou se simplesmente nao existir local ainda). Limitacao conhecida,
 * aceita por ora (ADR-007 presume uso single-user na pratica): se dois
 * dispositivos offline criarem abas no MESMO grupo ao mesmo tempo, o merge
 * nao recompacta `order` entre as duas origens — pode haver `order` duplicado
 * dentro do grupo ate a proxima reordenacao manual.
 */
export async function mergeGroupFromRemote(db: ArfyinDb, remote: Group): Promise<void> {
  const local = await db.get("groups", remote.id);
  if (!local || remote.updatedAt > local.updatedAt) {
    await db.put("groups", remote);
  }
}

export async function mergeTabFromRemote(db: ArfyinDb, remote: SavedTab): Promise<void> {
  const stored = await db.get("tabs", remote.id);
  const local = stored ? fromStoredTab(stored) : null;
  if (!local || remote.updatedAt > local.updatedAt) {
    await db.put("tabs", toStoredTab(remote));
  }
}

export async function listTabsByGroup(
  db: ArfyinDb,
  groupId: string | null,
): Promise<SavedTab[]> {
  const indexKey = groupId ?? UNGROUPED;
  const stored = await db.getAllFromIndex("tabs", "groupId", indexKey);
  return stored.map(fromStoredTab).sort((a, b) => a.order - b.order);
}

export function listUngroupedTabs(db: ArfyinDb): Promise<SavedTab[]> {
  return listTabsByGroup(db, null);
}

/** Usado ao desativar o pseudo-grupo "Sem categoria" nas configurações (apaga tudo que estava solto). */
export async function deleteAllUngroupedTabs(db: ArfyinDb): Promise<void> {
  const tabs = await listUngroupedTabs(db);
  const tx = db.transaction("tabs", "readwrite");
  await Promise.all(tabs.map((t) => tx.objectStore("tabs").delete(t.id)));
  await tx.done;
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

export async function reorderTab(db: ArfyinDb, tabId: string, newIndex: number): Promise<void> {
  const stored = await db.get("tabs", tabId);
  if (!stored) return;
  const tab = fromStoredTab(stored);
  const all = await listTabsByGroup(db, tab.groupId);
  const currentIndex = all.findIndex((t) => t.id === tabId);
  const siblings = all.filter((t) => t.id !== tabId);
  // `newIndex` e calculado pelo chamador sobre a lista COMPLETA (com o proprio
  // item ainda nela). Remover o item desloca tudo que vinha depois dele uma
  // posicao pra tras — sem este ajuste, soltar um item sobre um alvo que vem
  // DEPOIS da origem o insere depois do alvo em vez de antes (assimetria
  // confirmada manualmente: só ocorria quando newIndex > currentIndex).
  const adjustedIndex = currentIndex !== -1 && newIndex > currentIndex ? newIndex - 1 : newIndex;
  const clampedIndex = Math.max(0, Math.min(adjustedIndex, siblings.length));
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

export async function listAllTabs(db: ArfyinDb): Promise<SavedTab[]> {
  const stored = await db.getAll("tabs");
  return stored.map(fromStoredTab);
}

/**
 * Agrupa todas as abas por grupo numa unica leitura — substitui o padrao
 * anterior de 1 chamada por grupo em serie (N round-trips a cada `loadAll`
 * da new-tab). `sort` e estavel (garantido pelo motor V8/Chrome), entao
 * particionar por `groupId` depois de ordenar preserva a mesma ordem
 * relativa (por `order`) que `listTabsByGroup` produz por grupo.
 */
export async function listAllTabsGrouped(
  db: ArfyinDb,
): Promise<{ tabsByGroup: Record<string, SavedTab[]>; ungrouped: SavedTab[] }> {
  const all = await listAllTabs(db);
  const sorted = [...all].sort((a, b) => a.order - b.order);
  const tabsByGroup: Record<string, SavedTab[]> = {};
  const ungrouped: SavedTab[] = [];
  for (const tab of sorted) {
    if (tab.groupId === null) ungrouped.push(tab);
    else (tabsByGroup[tab.groupId] ??= []).push(tab);
  }
  return { tabsByGroup, ungrouped };
}

export async function exportAllData(db: ArfyinDb): Promise<DataExport> {
  const [groups, tabs] = await Promise.all([listGroups(db), listAllTabs(db)]);
  return { schemaVersion: 1, exportedAt: now(), groups, tabs };
}

/**
 * Importa um dump de dados **duplicando tudo** (novos ids via createGroup/
 * addTabToGroup, que ja calculam order corretamente) — nunca decide o que
 * descartar, conforme ADR-007. Preserva aparencia do grupo (cor/icone) e pin
 * das abas, mas nao os timestamps originais (viram "agora").
 */
export async function importDataExport(db: ArfyinDb, data: DataExport): Promise<void> {
  const oldToNewGroupId = new Map<string, string>();

  for (const group of data.groups) {
    const created = await createGroup(db, group.name);
    oldToNewGroupId.set(group.id, created.id);
    if (group.color !== null || group.icon !== null) {
      await updateGroupAppearance(db, created.id, { color: group.color, icon: group.icon });
    }
    if (group.collapsed) await setGroupCollapsed(db, created.id, true);
  }

  for (const tab of data.tabs) {
    const newGroupId = tab.groupId === null ? null : (oldToNewGroupId.get(tab.groupId) ?? null);
    await addTabToGroup(db, {
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.faviconUrl,
      groupId: newGroupId,
    });
  }
}

export async function exportConfig(db: ArfyinDb): Promise<ConfigExport> {
  return { schemaVersion: 1, exportedAt: now(), config: await getAppConfig(db) };
}

export async function importConfigExport(db: ArfyinDb, data: ConfigExport): Promise<void> {
  await setAppConfig(db, data.config);
}

/**
 * Export unico (dados + config) — substitui os dois arquivos/botoes
 * separados (`exportAllData`/`exportConfig`): um backup completo precisa de
 * um unico arquivo pra restaurar tudo de uma vez, sem o usuario ter que
 * lembrar de guardar/importar duas coisas separadas (e sem lidar com zip).
 */
export async function exportBackupBundle(db: ArfyinDb): Promise<BackupBundle> {
  const [groups, tabs, config] = await Promise.all([listGroups(db), listAllTabs(db), getAppConfig(db)]);
  return { schemaVersion: 1, exportedAt: now(), groups, tabs, config };
}

/** Dados sempre duplicados (ver `importDataExport`); config sempre substitui a anterior. */
export async function importBackupBundle(db: ArfyinDb, bundle: BackupBundle): Promise<void> {
  await importDataExport(db, { schemaVersion: 1, exportedAt: bundle.exportedAt, groups: bundle.groups, tabs: bundle.tabs });
  await setAppConfig(db, bundle.config);
}
