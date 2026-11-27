import type { ArfyinDb } from "@/shared/storage";
import {
  addAsset,
  addTabToGroup,
  createGroup,
  deleteAllUngroupedTabs,
  deleteAsset,
  deleteGroup,
  exportBackupBundle,
  getAppConfig,
  getAsset,
  getBackgroundCache,
  getTabById,
  importBackupBundle,
  listAllTabsGrouped,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  moveTab,
  removeTab,
  renameGroup,
  reorderGroup,
  reorderTab,
  setAppConfig,
  setBackgroundCache,
  setGroupCollapsed,
  updateGroupAppearance,
} from "@/shared/storage";
import { buildPong, isArfyinMessage, type ArfyinResponse, type RoutableMessage } from "@/shared/messaging";
import { getCurrentUserId, getRemoteDb } from "@/shared/supabaseClient";
import {
  drainQueue,
  enqueueConfigUpsert,
  enqueueGroupDelete,
  enqueueGroupUpsert,
  enqueueGroupsUpsert,
  enqueueTabDelete,
  enqueueTabUpsert,
  enqueueTabsUpsert,
  fullSync,
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
    .catch((err) => {
      // getRemoteDb()/getCurrentUserId() lancam se o .env nao estiver configurado
      // (ambiente de teste/dev sem Supabase) — nao deve quebrar a mutacao local,
      // mas precisa ficar visivel (senao mascara regressoes futuras reais).
      console.error("[arfyin] kickSync falhou:", err instanceof Error ? err.message : err);
    });
}

/**
 * Pull-and-merge do Supabase + drenagem da fila local. Chamado uma vez apos
 * login bem-sucedido (restaura dados salvos em outra maquina) e no alarme
 * periodico do background (converge mudancas feitas em outro dispositivo).
 */
export async function bootstrapSync(db: ArfyinDb): Promise<void> {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return;
  await fullSync(db, getRemoteDb(), userId);
}

/**
 * Roteador puro: recebe uma mensagem já validada e devolve a resposta.
 * Não depende de `chrome.*` — isolado para ser testável diretamente (ver
 * tests/background/router.test.ts). `src/background/index.ts` é a única
 * casca que liga isto ao `chrome.runtime.onMessage` real.
 */
export async function routeMessage(db: ArfyinDb, message: RoutableMessage): Promise<ArfyinResponse> {
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
      const renamed = groups.find((g) => g.id === message.id) ?? null;
      if (renamed) await enqueueGroupUpsert(db, renamed);
      kickSync(db);
      return { type: "GROUP_RENAMED", group: renamed };
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
    case "LIST_ALL_TABS": {
      const { tabsByGroup, ungrouped } = await listAllTabsGrouped(db);
      return { type: "ALL_TABS", tabsByGroup, ungrouped };
    }
    case "ADD_TAB": {
      const tab = await addTabToGroup(db, message.input);
      await enqueueTabUpsert(db, tab);
      kickSync(db);
      return { type: "TAB_ADDED", tab, tabs: await listTabsByGroup(db, tab.groupId) };
    }
    case "REMOVE_TAB": {
      const before = await findTabAnywhere(db, message.id);
      await removeTab(db, message.id);
      await enqueueTabDelete(db, message.id);
      kickSync(db);
      const groupId = before?.groupId ?? null;
      return { type: "TAB_REMOVED", groupId, tabs: await listTabsByGroup(db, groupId) };
    }
    case "GET_SYNC_STATUS":
      return { type: "SYNC_STATUS", status: await getSyncStatus(db) };
    case "SET_GROUP_COLLAPSED": {
      await setGroupCollapsed(db, message.id, message.collapsed);
      const group = (await findGroup(db, message.id)) ?? null;
      if (group) await enqueueGroupUpsert(db, group);
      kickSync(db);
      return { type: "GROUP_COLLAPSED_SET", group };
    }
    case "UPDATE_GROUP_APPEARANCE": {
      await updateGroupAppearance(db, message.id, { color: message.color, icon: message.icon });
      const group = (await findGroup(db, message.id)) ?? null;
      if (group) await enqueueGroupUpsert(db, group);
      kickSync(db);
      return { type: "GROUP_APPEARANCE_UPDATED", group };
    }
    case "REORDER_GROUP": {
      await reorderGroup(db, message.id, message.newIndex);
      const groups = await listGroups(db);
      await enqueueGroupsUpsert(db, groups);
      kickSync(db);
      return { type: "GROUP_REORDERED", groups };
    }
    case "REORDER_TAB": {
      const tab = await findTabAnywhere(db, message.id);
      await reorderTab(db, message.id, message.newIndex);
      const groupId = tab?.groupId ?? null;
      const tabs = await listTabsByGroup(db, groupId);
      if (tab) await enqueueTabsUpsert(db, tabs);
      kickSync(db);
      return { type: "TAB_REORDERED", groupId, tabs };
    }
    case "MOVE_TAB": {
      const before = await findTabAnywhere(db, message.id);
      await moveTab(db, message.id, message.newGroupId, message.newIndex);
      const sourceGroupId = before?.groupId ?? null;
      const [sourceTabs, destTabs] = await Promise.all([
        listTabsByGroup(db, sourceGroupId),
        listTabsByGroup(db, message.newGroupId),
      ]);
      if (before) await enqueueTabsUpsert(db, sourceTabs);
      await enqueueTabsUpsert(db, destTabs);
      kickSync(db);
      return {
        type: "TAB_MOVED",
        sourceGroupId,
        sourceTabs,
        destGroupId: message.newGroupId,
        destTabs,
      };
    }
    case "GET_CONFIG":
      return { type: "CONFIG", config: await getAppConfig(db) };
    case "SET_QUICK_ACCESS": {
      const config = await getAppConfig(db);
      await setAppConfig(db, { ...config, quickAccess: message.quickAccess });
      const updated = await getAppConfig(db);
      await enqueueConfigUpsert(db, updated);
      kickSync(db);
      return { type: "QUICK_ACCESS_SET", config: updated };
    }
    case "UPDATE_CONFIG": {
      const config = await getAppConfig(db);
      await setAppConfig(db, { ...config, ...message.patch });
      const updated = await getAppConfig(db);
      await enqueueConfigUpsert(db, updated);
      kickSync(db);
      return { type: "CONFIG_UPDATED", config: updated };
    }
    case "SET_UNGROUPED_ENABLED": {
      if (!message.enabled) {
        const toDelete = await listUngroupedTabs(db);
        await deleteAllUngroupedTabs(db);
        for (const tab of toDelete) await enqueueTabDelete(db, tab.id);
      }
      const config = await getAppConfig(db);
      await setAppConfig(db, { ...config, ungroupedEnabled: message.enabled });
      const updated = await getAppConfig(db);
      await enqueueConfigUpsert(db, updated);
      kickSync(db);
      return { type: "UNGROUPED_ENABLED_SET", config: updated, ungrouped: await listUngroupedTabs(db) };
    }
    case "EXPORT_BACKUP":
      return { type: "BACKUP_EXPORTED", data: await exportBackupBundle(db) };
    case "IMPORT_BACKUP": {
      await importBackupBundle(db, message.data);
      // Sem isto, os dados duplicados (import e sempre duplicar, nunca
      // substituir) ficavam so locais ate o usuario tocar manualmente em cada
      // item — violava a garantia de "nunca perder dado" para o caso de uso
      // central de backup/restore. Config tambem precisa subir (substitui a
      // anterior, ver `importBackupBundle`).
      const groups = await listGroups(db);
      await enqueueGroupsUpsert(db, groups);
      for (const group of groups) {
        await enqueueTabsUpsert(db, await listTabsByGroup(db, group.id));
      }
      await enqueueTabsUpsert(db, await listUngroupedTabs(db));
      await enqueueConfigUpsert(db, await getAppConfig(db));
      kickSync(db);
      return { type: "BACKUP_IMPORTED" };
    }
    case "ADD_ASSET":
      return { type: "ASSET_ADDED", id: await addAsset(db, message.blob) };
    case "GET_ASSET":
      return { type: "ASSET", blob: await getAsset(db, message.id) };
    case "DELETE_ASSET":
      await deleteAsset(db, message.id);
      return { type: "ASSET_DELETED" };
    case "GET_BACKGROUND_CACHE":
      return { type: "BACKGROUND_CACHE", entry: await getBackgroundCache(db, message.key) };
    case "SET_BACKGROUND_CACHE":
      await setBackgroundCache(db, message.key, message.entry);
      return { type: "BACKGROUND_CACHE_SET" };
    case "BOOTSTRAP_SYNC":
      await bootstrapSync(db);
      return { type: "BOOTSTRAP_SYNC_DONE" };
  }
}

export { isArfyinMessage };
