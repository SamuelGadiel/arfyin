import type { ArfyinDb } from "@/shared/storage";
import { addTabToGroup, createGroup, listGroups, listTabsByGroup } from "@/shared/storage";
import { buildPong, isArfyinMessage, type ArfyinMessage, type ArfyinResponse } from "@/shared/messaging";

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
    case "CREATE_GROUP":
      return { type: "GROUP_CREATED", group: await createGroup(db, message.name) };
    case "LIST_TABS_BY_GROUP":
      return { type: "TABS", tabs: await listTabsByGroup(db, message.groupId) };
    case "ADD_TAB":
      return { type: "TAB_ADDED", tab: await addTabToGroup(db, message.input) };
  }
}

export { isArfyinMessage };
