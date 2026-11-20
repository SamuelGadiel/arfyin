import { beforeEach, describe, expect, it } from "vitest";
import {
  addTabToGroup,
  createGroup,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  moveTab,
  openArfyinDb,
  reorderGroup,
  reorderTab,
  setGroupCollapsed,
  setTabPinned,
  updateGroupAppearance,
  type ArfyinDb,
} from "@/shared/storage";

let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

describe("setGroupCollapsed / updateGroupAppearance", () => {
  it("altera collapsed sem afetar outros campos", async () => {
    const group = await createGroup(db, "Jellyfin");
    await setGroupCollapsed(db, group.id, true);
    const [updated] = await listGroups(db);
    expect(updated?.collapsed).toBe(true);
    expect(updated?.name).toBe("Jellyfin");
  });

  it("atualiza cor e icone do grupo", async () => {
    const group = await createGroup(db, "Jellyfin");
    await updateGroupAppearance(db, group.id, { color: "#ff0000", icon: "tv" });
    const [updated] = await listGroups(db);
    expect(updated?.color).toBe("#ff0000");
    expect(updated?.icon).toBe("tv");
  });
});

describe("reorderGroup", () => {
  it("move um grupo para outra posicao e recompacta a ordem", async () => {
    const a = await createGroup(db, "A");
    await createGroup(db, "B");
    const c = await createGroup(db, "C");

    await reorderGroup(db, c.id, 0);

    const groups = await listGroups(db);
    expect(groups.map((g) => g.name)).toEqual(["C", "A", "B"]);
    expect(groups.map((g) => g.order)).toEqual([0, 1, 2]);
    void a;
  });
});

describe("setTabPinned", () => {
  it("fixa uma aba (passa a aparecer primeiro na listagem)", async () => {
    const group = await createGroup(db, "Grupo");
    await addTabToGroup(db, { url: "https://1.com", title: "1", groupId: group.id });
    const second = await addTabToGroup(db, { url: "https://2.com", title: "2", groupId: group.id });

    await setTabPinned(db, second.id, true);

    const tabs = await listTabsByGroup(db, group.id);
    expect(tabs[0]?.id).toBe(second.id);
    expect(tabs[0]?.pinned).toBe(true);
  });
});

describe("reorderTab", () => {
  it("reordena abas dentro do mesmo grupo e recompacta order", async () => {
    const group = await createGroup(db, "Grupo");
    const t1 = await addTabToGroup(db, { url: "https://1.com", title: "1", groupId: group.id });
    const t2 = await addTabToGroup(db, { url: "https://2.com", title: "2", groupId: group.id });
    const t3 = await addTabToGroup(db, { url: "https://3.com", title: "3", groupId: group.id });

    await reorderTab(db, t3.id, 0);

    const tabs = await listTabsByGroup(db, group.id);
    expect(tabs.map((t) => t.id)).toEqual([t3.id, t1.id, t2.id]);
    expect(tabs.map((t) => t.order)).toEqual([0, 1, 2]);
  });
});

describe("moveTab", () => {
  it("move uma aba para outro grupo, recompactando origem e destino", async () => {
    const groupA = await createGroup(db, "A");
    const groupB = await createGroup(db, "B");
    const a1 = await addTabToGroup(db, { url: "https://a1.com", title: "a1", groupId: groupA.id });
    const a2 = await addTabToGroup(db, { url: "https://a2.com", title: "a2", groupId: groupA.id });
    const b1 = await addTabToGroup(db, { url: "https://b1.com", title: "b1", groupId: groupB.id });

    await moveTab(db, a1.id, groupB.id, 0);

    const tabsA = await listTabsByGroup(db, groupA.id);
    const tabsB = await listTabsByGroup(db, groupB.id);

    expect(tabsA.map((t) => t.id)).toEqual([a2.id]);
    expect(tabsA.map((t) => t.order)).toEqual([0]);
    expect(tabsB.map((t) => t.id)).toEqual([a1.id, b1.id]);
    expect(tabsB.map((t) => t.order)).toEqual([0, 1]);
    expect(tabsB[0]?.groupId).toBe(groupB.id);
  });

  it("move uma aba para fora de qualquer grupo (groupId null)", async () => {
    const group = await createGroup(db, "A");
    const tab = await addTabToGroup(db, { url: "https://a.com", title: "a", groupId: group.id });

    await moveTab(db, tab.id, null);

    expect(await listTabsByGroup(db, group.id)).toEqual([]);
    const ungrouped = await listUngroupedTabs(db);
    expect(ungrouped.map((t) => t.id)).toEqual([tab.id]);
    expect(ungrouped[0]?.groupId).toBeNull();
  });
});
