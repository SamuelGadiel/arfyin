import type { ArfyinDb } from "@/shared/storage";
import {
  addTabToGroup,
  createGroup,
  deleteGroup,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  removeTab,
  renameGroup,
} from "@/shared/storage";
import { buildPong, isArfyinMessage, type ArfyinMessage, type ArfyinResponse } from "@/shared/messaging";
import { getCurrentUserId, getRemoteDb } from "@/shared/supabaseClient";
import {
  drainQueue,
  enqueueGroupDelete,
  enqueueGroupUpsert,
  enqueueTabDelete,
  enqueueTabUpsert,
  getSyncStatus,
} from "@/shared/sync";

/**
 * Dispara a drenagem da fila sem bloquear a resposta ao chamador (fire-and-forget).
 * Sem sessao (ainda sem ARF-011 implementado, ou usuario deslogado), nao tenta nada
 * — a mutacao fica so na fila local ate existir uma sessao.
 */
export function kickSync(db: ArfyinDb): void {
  getCurrentUserId()
    .then((userId) => {
      if (!userId) return;
      return drainQueue(db, getRemoteDb(), userId).then(() => undefined);
    })
    .catch(() => {
      // getRemoteDb()/getCurrentUserId() lancam se o .env nao estiver configurado
      // (ambiente de teste/dev sem Supabase) — silencioso de proposito, a fila
      // continua intacta e tenta de novo na proxima mutacao.
    });
}

/**
 * Roteador puro: recebe uma mensagem já validada e devolve a resposta.
 * Não depende de `chrome.*` — isolado para ser testável diretamente (ver
 * tests/background/router.test.ts). `src/background/index.ts` é a única
 * casca que liga isto ao `chrome.runtime.onMessage` real.
 */
export async function routeMessage(db: ArfyinDb, message: ArfyinMessage): Promise<ArfyinResponse> {
  switch (message.type) {
    case "PING":
      return buildPong();
    case "LIST_GROUPS":
      return { type: "GROUPS", groups: await listGroups(db) };
    case "CREATE_GROUP": {
      const group = await createGroup(db, message.name);
      await enqueueGroupUpsert(db, group);
      kickSync(db);
      return { type: "GROUP_CREATED", group };
    }
    case "RENAME_GROUP": {
      await renameGroup(db, message.id, message.name);
      const groups = await listGroups(db);
      const renamed = groups.find((g) => g.id === message.id);
      if (renamed) await enqueueGroupUpsert(db, renamed);
      kickSync(db);
      return { type: "GROUP_RENAMED" };
    }
    case "DELETE_GROUP": {
      await deleteGroup(db, message.id);
      await enqueueGroupDelete(db, message.id);
      kickSync(db);
      return { type: "GROUP_DELETED" };
    }
    case "LIST_TABS_BY_GROUP":
      return { type: "TABS", tabs: await listTabsByGroup(db, message.groupId) };
    case "LIST_UNGROUPED_TABS":
      return { type: "TABS", tabs: await listUngroupedTabs(db) };
    case "ADD_TAB": {
      const tab = await addTabToGroup(db, message.input);
      await enqueueTabUpsert(db, tab);
      kickSync(db);
      return { type: "TAB_ADDED", tab };
    }
    case "REMOVE_TAB": {
      await removeTab(db, message.id);
      await enqueueTabDelete(db, message.id);
      kickSync(db);
      return { type: "TAB_REMOVED" };
    }
    case "GET_SYNC_STATUS":
      return { type: "SYNC_STATUS", status: await getSyncStatus(db) };
  }
}

export { isArfyinMessage };
