import { beforeEach, describe, expect, it } from "vitest";
import {
  addTabToGroup,
  createGroup,
  deleteGroup,
  getAppConfig,
  getBackgroundCache,
  listGroups,
  listTabsByGroup,
  listUngroupedTabs,
  mergeConfigFromRemote,
  openArfyinDb,
  removeTab,
  renameGroup,
  setAppConfig,
  setBackgroundCache,
  type ArfyinDb,
} from "@/shared/storage";
import { defaultAppConfig } from "@/shared/types";

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

  it("remove uma aba salva", async () => {
    const tab = await addTabToGroup(db, { url: "https://x.com", title: "X" });
    await removeTab(db, tab.id);
    expect(await listUngroupedTabs(db)).toEqual([]);
  });

  it("remove uma aba do meio e recompacta order dos irmaos restantes", async () => {
    const group = await createGroup(db, "Grupo");
    const a = await addTabToGroup(db, { url: "https://a.com", title: "A", groupId: group.id });
    const b = await addTabToGroup(db, { url: "https://b.com", title: "B", groupId: group.id });
    const c = await addTabToGroup(db, { url: "https://c.com", title: "C", groupId: group.id });

    await removeTab(db, b.id);

    const remaining = await listTabsByGroup(db, group.id);
    expect(remaining.map((t) => t.id)).toEqual([a.id, c.id]);
    expect(remaining.map((t) => t.order)).toEqual([0, 1]);

    // sem a recompactacao, a nova aba colidiria com o order de C (que seria 2)
    const d = await addTabToGroup(db, { url: "https://d.com", title: "D", groupId: group.id });
    expect(d.order).toBe(2);
    const final = await listTabsByGroup(db, group.id);
    expect(final.map((t) => t.id)).toEqual([a.id, c.id, d.id]);
  });
});

describe("getAppConfig merge defensivo", () => {
  it("preenche campos novos de clock/background para um config parcial salvo antes deles existirem", async () => {
    // Simula um registro gravado antes de fontWeight/dateFormat existirem —
    // `config` no IndexedDB nao tem tipagem de escrita, entao um registro
    // legado real seria exatamente assim (campos faltando).
    const legacy = {
      quickAccess: [],
      layoutMode: "coexistent",
      clock: { fontSize: 48, color: "#eaeaea" },
      background: defaultAppConfig().background,
    };
    await db.put("config", legacy as never, "appConfig");

    const config = await getAppConfig(db);
    expect(config.clock.fontWeight).toBe(defaultAppConfig().clock.fontWeight);
    expect(config.clock.dateFormat).toBe(defaultAppConfig().clock.dateFormat);
    expect(config.clock.customDateFormat).toBe(defaultAppConfig().clock.customDateFormat);
  });

  it("preserva valores customizados ja salvos (nao reseta pro default)", async () => {
    const custom = { ...defaultAppConfig(), clock: { ...defaultAppConfig().clock, fontWeight: 700 } };
    await setAppConfig(db, custom);
    expect((await getAppConfig(db)).clock.fontWeight).toBe(700);
  });

  it("setAppConfig sempre sobrescreve updatedAt para agora, independente do que o chamador passar", async () => {
    await setAppConfig(db, { ...defaultAppConfig(), updatedAt: 123 });
    expect((await getAppConfig(db)).updatedAt).not.toBe(123);
    expect((await getAppConfig(db)).updatedAt).toBeGreaterThan(0);
  });
});

describe("mergeConfigFromRemote", () => {
  it("adota a config remota quando nao ha nenhuma local ainda", async () => {
    const remote = { ...defaultAppConfig(), layoutMode: "no-clock" as const, updatedAt: 500 };
    await mergeConfigFromRemote(db, remote);
    expect((await getAppConfig(db)).layoutMode).toBe("no-clock");
  });

  it("nao sobrescreve uma config local mais recente que a remota", async () => {
    await setAppConfig(db, { ...defaultAppConfig(), layoutMode: "no-clock" });
    const localUpdatedAt = (await getAppConfig(db)).updatedAt;

    const staleRemote = { ...defaultAppConfig(), layoutMode: "scroll-reveal" as const, updatedAt: localUpdatedAt - 1000 };
    await mergeConfigFromRemote(db, staleRemote);

    expect((await getAppConfig(db)).layoutMode).toBe("no-clock");
  });

  it("adota a config remota quando ela e mais recente que a local", async () => {
    await setAppConfig(db, { ...defaultAppConfig(), layoutMode: "no-clock" });
    const localUpdatedAt = (await getAppConfig(db)).updatedAt;

    const newerRemote = { ...defaultAppConfig(), layoutMode: "scroll-reveal" as const, updatedAt: localUpdatedAt + 1000 };
    await mergeConfigFromRemote(db, newerRemote);

    expect((await getAppConfig(db)).layoutMode).toBe("scroll-reveal");
  });
});

describe("background cache", () => {
  it("retorna null quando nao ha cache para a chave", async () => {
    expect(await getBackgroundCache(db, "unsplash:foo")).toBeNull();
  });

  it("grava e le o cache por chave", async () => {
    const entry = { candidates: [{ url: "https://x.com/a.jpg" }], fetchedAt: 123 };
    await setBackgroundCache(db, "unsplash:foo", entry);
    expect(await getBackgroundCache(db, "unsplash:foo")).toEqual(entry);
    expect(await getBackgroundCache(db, "reddit:bar")).toBeNull();
  });
});
