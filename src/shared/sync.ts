import {
  enqueueSyncOp,
  getSyncStatus,
  listSyncQueue,
  mergeConfigFromRemote,
  mergeGroupFromRemote,
  mergeTabFromRemote,
  removeSyncOp,
  setSyncStatus,
  type ArfyinDb,
  type SyncStatus,
} from "./storage";
import {
  deleteRemoteGroup,
  deleteRemoteTab,
  pullAllTabs,
  pullConfig,
  pullGroups,
  pushConfig,
  pushGroup,
  pushTab,
  type RemoteDb,
} from "./remote";
import type { AppConfig, Group, SavedTab } from "./types";

export function enqueueGroupUpsert(db: ArfyinDb, group: Group): Promise<void> {
  return enqueueSyncOp(db, { table: "groups", op: "upsert", entityId: group.id, payload: group });
}

export function enqueueGroupsUpsert(db: ArfyinDb, groups: Group[]): Promise<void[]> {
  return Promise.all(groups.map((group) => enqueueGroupUpsert(db, group)));
}

export function enqueueTabsUpsert(db: ArfyinDb, tabs: SavedTab[]): Promise<void[]> {
  return Promise.all(tabs.map((tab) => enqueueTabUpsert(db, tab)));
}

export function enqueueGroupDelete(db: ArfyinDb, id: string): Promise<void> {
  return enqueueSyncOp(db, { table: "groups", op: "delete", entityId: id });
}

export function enqueueTabUpsert(db: ArfyinDb, tab: SavedTab): Promise<void> {
  return enqueueSyncOp(db, { table: "tabs", op: "upsert", entityId: tab.id, payload: tab });
}

export function enqueueTabDelete(db: ArfyinDb, id: string): Promise<void> {
  return enqueueSyncOp(db, { table: "tabs", op: "delete", entityId: id });
}

/** Config nunca e "deletada", so substituida — sempre upsert, chave fixa por usuario. */
export function enqueueConfigUpsert(db: ArfyinDb, config: AppConfig): Promise<void> {
  return enqueueSyncOp(db, { table: "config", op: "upsert", entityId: "config", payload: config });
}

/**
 * Erros de rede/conectividade sao transientes (vale parar e tentar tudo de
 * novo mais tarde); qualquer outro erro (constraint, RLS, payload invalido)
 * nao se resolve sozinho tentando de novo — nao deve travar os itens
 * seguintes da fila atras dele para sempre.
 */
function looksLikeNetworkError(message: string): boolean {
  return /fetch|network|timeout|offline|failed to fetch|ENOTFOUND|ECONNREFUSED/i.test(message);
}

/**
 * Drena a fila em ordem, sequencialmente (preserva causalidade das mutacoes).
 * Erro de rede: para no primeiro e marca `unreachable` (ADR-010) — nao perde o
 * resto da fila, proxima chamada tenta de novo a partir de onde parou. Erro de
 * dado (nao-transiente): loga, mantem o item na fila (nao descarta operacao)
 * e CONTINUA para os proximos — um item com payload invalido nao deve
 * bloquear indefinidamente tudo que foi enfileirado depois dele.
 */
export async function drainQueue(
  localDb: ArfyinDb,
  remoteDb: RemoteDb,
  userId: string,
): Promise<SyncStatus> {
  const queue = await listSyncQueue(localDb);
  if (queue.length === 0) {
    const idle: SyncStatus = { state: "idle", lastError: null, lastSuccessAt: Date.now() };
    await setSyncStatus(localDb, idle);
    return idle;
  }

  await setSyncStatus(localDb, {
    state: "syncing",
    lastError: null,
    lastSuccessAt: (await getSyncStatus(localDb)).lastSuccessAt,
  });

  let lastDataError: string | null = null;

  for (const op of queue) {
    try {
      if (op.table === "groups") {
        if (op.op === "upsert") await pushGroup(remoteDb, userId, op.payload as Group);
        else await deleteRemoteGroup(remoteDb, userId, op.entityId);
      } else if (op.table === "tabs") {
        if (op.op === "upsert") await pushTab(remoteDb, userId, op.payload as SavedTab);
        else await deleteRemoteTab(remoteDb, userId, op.entityId);
      } else {
        await pushConfig(remoteDb, userId, op.payload as AppConfig);
      }
      await removeSyncOp(localDb, op.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (looksLikeNetworkError(message)) {
        const status: SyncStatus = {
          state: "unreachable",
          lastError: message,
          lastSuccessAt: (await getSyncStatus(localDb)).lastSuccessAt,
        };
        await setSyncStatus(localDb, status);
        return status;
      }
      console.error(`[arfyin] sync: operacao ${op.id} (${op.table}/${op.op}) falhou, pulando:`, message);
      lastDataError = message;
    }
  }

  const finalStatus: SyncStatus = { state: "idle", lastError: lastDataError, lastSuccessAt: Date.now() };
  await setSyncStatus(localDb, finalStatus);
  return finalStatus;
}

/**
 * Puxa tudo que o usuario tem no Supabase e mescla no IndexedDB local
 * (last-write-wins por `updatedAt` — ver mergeGroupFromRemote/mergeTabFromRemote).
 * Chamado no login (restaurar dados numa maquina nova) e no alarme periodico
 * (convergir mudancas feitas em outro dispositivo). Nunca sobrescreve uma
 * mudanca local mais recente que ainda nao subiu.
 */
export async function pullAndMerge(localDb: ArfyinDb, remoteDb: RemoteDb, userId: string): Promise<void> {
  const [remoteGroups, remoteTabs, remoteConfig] = await Promise.all([
    pullGroups(remoteDb, userId),
    pullAllTabs(remoteDb, userId),
    pullConfig(remoteDb, userId),
  ]);
  for (const group of remoteGroups) await mergeGroupFromRemote(localDb, group);
  for (const tab of remoteTabs) await mergeTabFromRemote(localDb, tab);
  if (remoteConfig) await mergeConfigFromRemote(localDb, remoteConfig);
}

/** Pull-and-merge seguido de drenar a fila local — usado no login e no alarme periodico. */
export async function fullSync(localDb: ArfyinDb, remoteDb: RemoteDb, userId: string): Promise<SyncStatus> {
  await pullAndMerge(localDb, remoteDb, userId);
  return drainQueue(localDb, remoteDb, userId);
}

export { getSyncStatus };
