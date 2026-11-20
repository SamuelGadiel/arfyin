import { beforeEach, describe, expect, it } from "vitest";
import {
  addTabToGroup,
  createGroup,
  exportAllData,
  exportConfig,
  getAppConfig,
  importConfigExport,
  importDataExport,
  listAllTabs,
  listGroups,
  openArfyinDb,
  setGroupCollapsed,
  setTabPinned,
  updateGroupAppearance,
  type ArfyinDb,
} from "@/shared/storage";

let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

describe("export/import de dados", () => {
  it("exporta todos os grupos e abas (incluindo soltas)", async () => {
    const group = await createGroup(db, "Jellyfin");
    await addTabToGroup(db, { url: "https://a.com", title: "A", groupId: group.id });
    await addTabToGroup(db, { url: "https://solta.com", title: "Solta" });

    const dump = await exportAllData(db);

    expect(dump.schemaVersion).toBe(1);
    expect(dump.groups).toHaveLength(1);
    expect(dump.tabs).toHaveLength(2);
  });

  it("importar duplica tudo com novos ids, preservando estrutura e aparencia", async () => {
    const group = await createGroup(db, "Jellyfin");
    await updateGroupAppearance(db, group.id, { color: "#f00", icon: "tv" });
    await setGroupCollapsed(db, group.id, true);
    const tab = await addTabToGroup(db, { url: "https://a.com", title: "A", groupId: group.id });
    await setTabPinned(db, tab.id, true);

    const dump = await exportAllData(db);
    await importDataExport(db, dump);

    // original + duplicado = 2 (import nunca decide o que descartar/substituir)
    const groups = await listGroups(db);
    expect(groups).toHaveLength(2);
    const imported = groups.find((g) => g.id !== group.id);
    expect(imported?.name).toBe("Jellyfin");
    expect(imported?.color).toBe("#f00");
    expect(imported?.icon).toBe("tv");
    expect(imported?.collapsed).toBe(true);

    const tabs = await listAllTabs(db);
    expect(tabs).toHaveLength(2);
    const importedTab = tabs.find((t) => t.id !== tab.id);
    expect(importedTab?.groupId).toBe(imported?.id);
    expect(importedTab?.pinned).toBe(true);
  });

  it("importar duas vezes duplica tudo (nunca decide o que descartar)", async () => {
    const group = await createGroup(db, "Jellyfin");
    await addTabToGroup(db, { url: "https://a.com", title: "A", groupId: group.id });

    const dump = await exportAllData(db);
    await importDataExport(db, dump);
    await importDataExport(db, dump);

    const groups = await listGroups(db);
    const tabs = await listAllTabs(db);
    // original + 2 importacoes = 3 grupos, 3 abas
    expect(groups).toHaveLength(3);
    expect(tabs).toHaveLength(3);
    expect(new Set(groups.map((g) => g.id)).size).toBe(3);
  });

  it("aba solta (sem grupo) continua solta apos importar", async () => {
    await addTabToGroup(db, { url: "https://solta.com", title: "Solta" });
    const dump = await exportAllData(db);
    await importDataExport(db, dump);

    const tabs = await listAllTabs(db);
    expect(tabs.every((t) => t.groupId === null)).toBe(true);
  });
});

describe("export/import de configuracao", () => {
  it("exporta e importa substituindo a configuracao inteira", async () => {
    const exported = await exportConfig(db);
    expect(exported.config.quickAccess).toEqual([]);

    const newConfig = {
      quickAccess: [{ slot: 1, url: "https://x.com", title: "X" }],
      layoutMode: "no-clock" as const,
      clock: { format24h: false },
    };
    await importConfigExport(db, { schemaVersion: 1, exportedAt: 123, config: newConfig });

    expect(await getAppConfig(db)).toEqual(newConfig);
  });
});
