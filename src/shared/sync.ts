import {
  enqueueSyncOp,
  getSyncStatus,
  listSyncQueue,
  removeSyncOp,
  setSyncStatus,
  type ArfyinDb,
  type SyncStatus,
} from "./storage";
import {
  deleteRemoteGroup,
  deleteRemoteTab,
  pushGroup,
  pushTab,
  type RemoteDb,
} from "./remote";
import type { Group, SavedTab } from "./types";

export function enqueueGroupUpsert(db: ArfyinDb, group: Group): Promise<void> {
  return enqueueSyncOp(db, { table: "groups", op: "upsert", entityId: group.id, payload: group });
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

/**
 * Drena a fila em ordem, sequencialmente (preserva causalidade das mutacoes).
 * Para no primeiro erro (ex.: Supabase pausado/offline) e marca `unreachable` —
 * nao perde o resto da fila (ADR-010). Proxima chamada (proxima mutacao ou o
 * alarme periodico do background) tenta de novo a partir de onde parou.
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

  for (const op of queue) {
    try {
      if (op.table === "groups") {
        if (op.op === "upsert") await pushGroup(remoteDb, userId, op.payload as Group);
        else await deleteRemoteGroup(remoteDb, userId, op.entityId);
      } else {
        if (op.op === "upsert") await pushTab(remoteDb, userId, op.payload as SavedTab);
        else await deleteRemoteTab(remoteDb, userId, op.entityId);
      }
      await removeSyncOp(localDb, op.id);
    } catch (err) {
      const status: SyncStatus = {
        state: "unreachable",
        lastError: err instanceof Error ? err.message : String(err),
        lastSuccessAt: (await getSyncStatus(localDb)).lastSuccessAt,
      };
      await setSyncStatus(localDb, status);
      return status;
    }
  }

  const success: SyncStatus = { state: "idle", lastError: null, lastSuccessAt: Date.now() };
  await setSyncStatus(localDb, success);
  return success;
}

export { getSyncStatus };
