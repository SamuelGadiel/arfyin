import { beforeEach, describe, expect, it } from "vitest";
import { routeMessage } from "@/background/router";
import { createGroup, listSyncQueue, openArfyinDb, type ArfyinDb } from "@/shared/storage";
import { defaultAppConfig, type BackupBundle } from "@/shared/types";

let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

describe("routeMessage", () => {
  it("responde PING com PONG", async () => {
    const response = await routeMessage(db, { type: "PING" });
    expect(response.type).toBe("PONG");
  });

  it("LIST_GROUPS retorna grupos vazios inicialmente", async () => {
    const response = await routeMessage(db, { type: "LIST_GROUPS" });
    expect(response).toEqual({ type: "GROUPS", groups: [] });
  });

  it("CREATE_GROUP cria e devolve o grupo criado", async () => {
    const response = await routeMessage(db, { type: "CREATE_GROUP", name: "Jellyfin" });
    expect(response.type).toBe("GROUP_CREATED");
    if (response.type === "GROUP_CREATED") {
      expect(response.group.name).toBe("Jellyfin");
    }
  });

  it("LIST_TABS_BY_GROUP retorna as abas do grupo pedido", async () => {
    const group = await createGroup(db, "Grupo");
    await routeMessage(db, {
      type: "ADD_TAB",
      input: { url: "https://a.com", title: "A", groupId: group.id },
    });

    const response = await routeMessage(db, { type: "LIST_TABS_BY_GROUP", groupId: group.id });
    expect(response.type).toBe("TABS");
    if (response.type === "TABS") {
      expect(response.tabs).toHaveLength(1);
      expect(response.tabs[0]?.title).toBe("A");
    }
  });

  it("GET_BACKGROUND_CACHE retorna null quando nao ha cache", async () => {
    const response = await routeMessage(db, { type: "GET_BACKGROUND_CACHE", key: "unsplash:x" });
    expect(response).toEqual({ type: "BACKGROUND_CACHE", entry: null });
  });

  it("SET_BACKGROUND_CACHE grava e GET_BACKGROUND_CACHE le de volta", async () => {
    const entry = { candidates: [{ url: "https://x.com/a.jpg" }], fetchedAt: 123 };
    await routeMessage(db, { type: "SET_BACKGROUND_CACHE", key: "unsplash:x", entry });

    const response = await routeMessage(db, { type: "GET_BACKGROUND_CACHE", key: "unsplash:x" });
    expect(response).toEqual({ type: "BACKGROUND_CACHE", entry });
  });

  it("BOOTSTRAP_SYNC responde DONE mesmo sem sessao/credenciais (no-op silencioso)", async () => {
    const response = await routeMessage(db, { type: "BOOTSTRAP_SYNC" });
    expect(response).toEqual({ type: "BOOTSTRAP_SYNC_DONE" });
  });

  it("UPDATE_CONFIG enfileira a config para sync", async () => {
    await routeMessage(db, { type: "UPDATE_CONFIG", patch: { layoutMode: "no-clock" } });
    const queue = await listSyncQueue(db);
    expect(queue.map((op) => op.table)).toContain("config");
  });

  it("LIST_ALL_TABS agrupa abas por grupo numa unica resposta (sem N chamadas por grupo)", async () => {
    const g1 = await createGroup(db, "G1");
    const g2 = await createGroup(db, "G2");
    await routeMessage(db, { type: "ADD_TAB", input: { url: "https://a.com", title: "A", groupId: g1.id } });
    await routeMessage(db, { type: "ADD_TAB", input: { url: "https://b.com", title: "B", groupId: g2.id } });
    await routeMessage(db, { type: "ADD_TAB", input: { url: "https://c.com", title: "C", groupId: null } });

    const response = await routeMessage(db, { type: "LIST_ALL_TABS" });
    expect(response.type).toBe("ALL_TABS");
    if (response.type === "ALL_TABS") {
      expect(response.tabsByGroup[g1.id]?.map((t) => t.title)).toEqual(["A"]);
      expect(response.tabsByGroup[g2.id]?.map((t) => t.title)).toEqual(["B"]);
      expect(response.ungrouped.map((t) => t.title)).toEqual(["C"]);
    }
  });

  it("REORDER_TAB devolve a lista atualizada do grupo afetado", async () => {
    const group = await createGroup(db, "G");
    const addA = await routeMessage(db, { type: "ADD_TAB", input: { url: "https://a.com", title: "A", groupId: group.id } });
    await routeMessage(db, { type: "ADD_TAB", input: { url: "https://b.com", title: "B", groupId: group.id } });
    await routeMessage(db, { type: "ADD_TAB", input: { url: "https://c.com", title: "C", groupId: group.id } });
    if (addA.type !== "TAB_ADDED") throw new Error("esperado TAB_ADDED");

    // A esta no indice 0; mover para o indice 2 (posicao de C na lista completa [A,B,C]).
    const response = await routeMessage(db, { type: "REORDER_TAB", id: addA.tab.id, newIndex: 2 });
    expect(response.type).toBe("TAB_REORDERED");
    if (response.type === "TAB_REORDERED") {
      expect(response.groupId).toBe(group.id);
      expect(response.tabs.map((t) => t.title)).toEqual(["B", "A", "C"]);
    }
  });

  it("MOVE_TAB devolve as listas de origem e destino atualizadas", async () => {
    const source = await createGroup(db, "Origem");
    const dest = await createGroup(db, "Destino");
    const added = await routeMessage(db, { type: "ADD_TAB", input: { url: "https://a.com", title: "A", groupId: source.id } });
    if (added.type !== "TAB_ADDED") throw new Error("esperado TAB_ADDED");

    const response = await routeMessage(db, { type: "MOVE_TAB", id: added.tab.id, newGroupId: dest.id });
    expect(response.type).toBe("TAB_MOVED");
    if (response.type === "TAB_MOVED") {
      expect(response.sourceGroupId).toBe(source.id);
      expect(response.sourceTabs).toEqual([]);
      expect(response.destGroupId).toBe(dest.id);
      expect(response.destTabs.map((t) => t.title)).toEqual(["A"]);
    }
  });

  it("UPDATE_CONFIG devolve a config ja atualizada", async () => {
    const response = await routeMessage(db, { type: "UPDATE_CONFIG", patch: { layoutMode: "no-clock" } });
    expect(response.type).toBe("CONFIG_UPDATED");
    if (response.type === "CONFIG_UPDATED") {
      expect(response.config.layoutMode).toBe("no-clock");
    }
  });

  it("IMPORT_BACKUP enfileira grupos/abas/config importados para sync (nao ficam so locais)", async () => {
    const data: BackupBundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      groups: [
        {
          id: "g1",
          name: "Importado",
          color: null,
          icon: null,
          order: 0,
          collapsed: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      tabs: [
        {
          id: "t1",
          groupId: "g1",
          url: "https://x.com",
          title: "X",
          faviconUrl: null,
          order: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      config: defaultAppConfig(),
    };

    await routeMessage(db, { type: "IMPORT_BACKUP", data });

    const queue = await listSyncQueue(db);
    const tables = queue.map((op) => op.table);
    expect(tables).toContain("groups");
    expect(tables).toContain("tabs");
    expect(tables).toContain("config");
  });
});
