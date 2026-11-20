import { beforeEach, describe, expect, it } from "vitest";
import {
  addTabToGroup,
  createGroup,
  deleteGroup,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  openArfyinDb,
  removeTab,
  renameGroup,
  type ArfyinDb,
} from "@/shared/storage";

// Cada teste abre um banco com nome unico para nao vazar estado entre casos.
let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

describe("groups", () => {
  it("cria um grupo com order incremental", async () => {
    const first = await createGroup(db, "Jellyfin");
    const second = await createGroup(db, "Trabalho");

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
    expect(await listGroups(db)).toEqual([first, second]);
  });

  it("lista grupos vazios sem erro", async () => {
    expect(await listGroups(db)).toEqual([]);
  });

  it("renomeia um grupo existente", async () => {
    const group = await createGroup(db, "Nome antigo");
    await renameGroup(db, group.id, "Nome novo");

    const [updated] = await listGroups(db);
    expect(updated?.name).toBe("Nome novo");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(group.updatedAt);
  });

  it("renomear grupo inexistente nao lanca erro", async () => {
    await expect(renameGroup(db, "id-que-nao-existe", "x")).resolves.toBeUndefined();
  });

  it("deletar grupo remove tambem suas abas (cascata)", async () => {
    const group = await createGroup(db, "Media Server");
    await addTabToGroup(db, { url: "https://jellyfin.org", title: "Jellyfin", groupId: group.id });
    await addTabToGroup(db, { url: "https://sonarr.tv", title: "Sonarr", groupId: group.id });

    await deleteGroup(db, group.id);

    expect(await listGroups(db)).toEqual([]);
    expect(await listTabsByGroup(db, group.id)).toEqual([]);
  });
});

describe("tabs", () => {
  it("adiciona aba a um grupo com order incremental dentro do grupo", async () => {
    const group = await createGroup(db, "Jellyfin");
    const tab1 = await addTabToGroup(db, { url: "https://a.com", title: "A", groupId: group.id });
    const tab2 = await addTabToGroup(db, { url: "https://b.com", title: "B", groupId: group.id });

    expect(tab1.order).toBe(0);
    expect(tab2.order).toBe(1);
  });

  it("aba sem groupId fica como solta (ungrouped)", async () => {
    const tab = await addTabToGroup(db, { url: "https://solo.com", title: "Solo" });
    expect(tab.groupId).toBeNull();
    expect(await listUngroupedTabs(db)).toEqual([tab]);
  });

  it("grupos diferentes tem contagem de order independente", async () => {
    const groupA = await createGroup(db, "A");
    const groupB = await createGroup(db, "B");
    await addTabToGroup(db, { url: "https://a1.com", title: "A1", groupId: groupA.id });
    const firstOfB = await addTabToGroup(db, { url: "https://b1.com", title: "B1", groupId: groupB.id });

    expect(firstOfB.order).toBe(0);
  });

  it("abas fixadas (pinned) aparecem antes das nao fixadas, independente da order", async () => {
    const group = await createGroup(db, "Grupo");
    await addTabToGroup(db, { url: "https://1.com", title: "1", groupId: group.id });
    await addTabToGroup(db, { url: "https://2.com", title: "2", groupId: group.id });
    const third = await addTabToGroup(db, { url: "https://3.com", title: "3", groupId: group.id, pinned: true });

    const tabs = await listTabsByGroup(db, group.id);
    expect(tabs[0]?.id).toBe(third.id);
  });

  it("remove uma aba salva", async () => {
    const tab = await addTabToGroup(db, { url: "https://x.com", title: "X" });
    await removeTab(db, tab.id);
    expect(await listUngroupedTabs(db)).toEqual([]);
  });
});
