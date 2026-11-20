import { beforeEach, describe, expect, it } from "vitest";
import { routeMessage } from "@/background/router";
import { createGroup, openArfyinDb, type ArfyinDb } from "@/shared/storage";

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
});
