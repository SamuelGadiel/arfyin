import type { ArfyinDb } from "@/shared/storage";
import {
  addTabToGroup,
  createGroup,
  deleteGroup,
  exportAllData,
  exportConfig,
  getAppConfig,
  getTabById,
  importConfigExport,
  importDataExport,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  moveTab,
  removeTab,
  renameGroup,
  reorderGroup,
  reorderTab,
  setAppConfig,
  setGroupCollapsed,
  setTabPinned,
  updateGroupAppearance,
} from "@/shared/storage";
import { buildPong, isArfyinMessage, type ArfyinMessage, type ArfyinResponse } from "@/shared/messaging";
import { getCurrentUserId, getRemoteDb } from "@/shared/supabaseClient";
import {
  drainQueue,
  enqueueGroupDelete,
  enqueueGroupUpsert,
  enqueueGroupsUpsert,
  enqueueTabDelete,
  enqueueTabUpsert,
  enqueueTabsUpsert,
  getSyncStatus,
} from "@/shared/sync";

async function findGroup(db: ArfyinDb, id: string) {
  const groups = await listGroups(db);
  return groups.find((g) => g.id === id);
}

const findTabAnywhere = getTabById;

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
    case "SET_GROUP_COLLAPSED": {
      await setGroupCollapsed(db, message.id, message.collapsed);
      const group = await findGroup(db, message.id);
      if (group) await enqueueGroupUpsert(db, group);
      kickSync(db);
      return { type: "GROUP_COLLAPSED_SET" };
    }
    case "UPDATE_GROUP_APPEARANCE": {
      await updateGroupAppearance(db, message.id, { color: message.color, icon: message.icon });
      const group = await findGroup(db, message.id);
      if (group) await enqueueGroupUpsert(db, group);
      kickSync(db);
      return { type: "GROUP_APPEARANCE_UPDATED" };
    }
    case "REORDER_GROUP": {
      await reorderGroup(db, message.id, message.newIndex);
      await enqueueGroupsUpsert(db, await listGroups(db));
      kickSync(db);
      return { type: "GROUP_REORDERED" };
    }
    case "SET_TAB_PINNED": {
      await setTabPinned(db, message.id, message.pinned);
      const tab = await findTabAnywhere(db, message.id);
      if (tab) await enqueueTabUpsert(db, tab);
      kickSync(db);
      return { type: "TAB_PINNED_SET" };
    }
    case "REORDER_TAB": {
      const tab = await findTabAnywhere(db, message.id);
      await reorderTab(db, message.id, message.newIndex);
      if (tab) await enqueueTabsUpsert(db, await listTabsByGroup(db, tab.groupId));
      kickSync(db);
      return { type: "TAB_REORDERED" };
    }
    case "MOVE_TAB": {
      const before = await findTabAnywhere(db, message.id);
      await moveTab(db, message.id, message.newGroupId, message.newIndex);
      if (before) {
        await enqueueTabsUpsert(db, await listTabsByGroup(db, before.groupId));
      }
      await enqueueTabsUpsert(db, await listTabsByGroup(db, message.newGroupId));
      kickSync(db);
      return { type: "TAB_MOVED" };
    }
    case "GET_CONFIG":
      return { type: "CONFIG", config: await getAppConfig(db) };
    case "SET_QUICK_ACCESS": {
      const config = await getAppConfig(db);
      await setAppConfig(db, { ...config, quickAccess: message.quickAccess });
      return { type: "QUICK_ACCESS_SET" };
    }
    case "EXPORT_DATA":
      return { type: "DATA_EXPORTED", data: await exportAllData(db) };
    case "IMPORT_DATA":
      await importDataExport(db, message.data);
      return { type: "DATA_IMPORTED" };
    case "EXPORT_CONFIG":
      return { type: "CONFIG_EXPORTED", data: await exportConfig(db) };
    case "IMPORT_CONFIG":
      await importConfigExport(db, message.data);
      return { type: "CONFIG_IMPORTED" };
  }
}

export { isArfyinMessage };
