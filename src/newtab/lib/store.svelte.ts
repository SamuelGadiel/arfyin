import { send } from "./client";
import { defaultAppConfig, type AppConfig, type Group, type QuickAccessItem, type SavedTab } from "@/shared/types";

class ArfyinStore {
  groups: Group[] = $state([]);
  tabsByGroup: Record<string, SavedTab[]> = $state({});
  ungrouped: SavedTab[] = $state([]);
  loaded = $state(false);
  // Resolve ANTES de `loaded`: config decide o layout/background, que não deve
  // esperar abas+grupos carregarem — evita o flash de "layout errado por um
  // instante" (ex.: scroll-reveal aparecendo como coexistent até o config real
  // chegar). App.svelte so renderiza o layout quando `configLoaded` é true.
  configLoaded = $state(false);
  config: AppConfig = $state(defaultAppConfig());

  /** Substitui a fatia de abas de um grupo (ou das soltas, se `groupId` for null). */
  private setTabsSlice(groupId: string | null, tabs: SavedTab[]): void {
    if (groupId === null) {
      this.ungrouped = tabs;
    } else {
      this.tabsByGroup = { ...this.tabsByGroup, [groupId]: tabs };
    }
  }

  private upsertGroup(group: Group): void {
    const index = this.groups.findIndex((g) => g.id === group.id);
    if (index === -1) {
      this.groups = [...this.groups, group].sort((a, b) => a.order - b.order);
    } else {
      this.groups = this.groups.map((g) => (g.id === group.id ? group : g));
    }
  }

  async loadAll(): Promise<void> {
    // Config resolve assim que chega, sem esperar groups/tabs (evita o flash
    // de layout errado por um instante — ver `configLoaded`).
    const configPromise = send<"CONFIG">({ type: "GET_CONFIG" }).then((res) => {
      if (res.type === "CONFIG") this.config = res.config;
      this.configLoaded = true;
    });

    // Antes: 1 chamada IPC por grupo em serie (N round-trips bloqueantes a
    // cada carregamento). `LIST_ALL_TABS` agrega tudo numa unica leitura do
    // lado do background; groups e tabs rodam em paralelo entre si.
    const dataPromise = Promise.all([
      send<"GROUPS">({ type: "LIST_GROUPS" }),
      send<"ALL_TABS">({ type: "LIST_ALL_TABS" }),
    ]).then(([groupsRes, allTabsRes]) => {
      this.groups = groupsRes.type === "GROUPS" ? groupsRes.groups : [];
      this.tabsByGroup = allTabsRes.type === "ALL_TABS" ? allTabsRes.tabsByGroup : {};
      this.ungrouped = allTabsRes.type === "ALL_TABS" ? allTabsRes.ungrouped : [];
      this.loaded = true;
    });

    await Promise.all([configPromise, dataPromise]);
  }

  async setQuickAccess(quickAccess: QuickAccessItem[]): Promise<void> {
    const res = await send<"QUICK_ACCESS_SET">({ type: "SET_QUICK_ACCESS", quickAccess });
    this.config = res.config;
  }

  isQuickAccess(url: string): boolean {
    return this.config.quickAccess.some((i) => i.url === url);
  }

  /** Adiciona no primeiro slot livre (1-9); nao faz nada se ja estiver cheio ou a URL ja estiver la. Devolve se conseguiu. */
  async addQuickAccess(title: string, url: string): Promise<boolean> {
    if (this.isQuickAccess(url)) return false;
    const usedSlots = new Set(this.config.quickAccess.map((i) => i.slot));
    const nextSlot = Array.from({ length: 9 }, (_, i) => i + 1).find((s) => !usedSlots.has(s));
    if (!nextSlot) return false;
    await this.setQuickAccess([...this.config.quickAccess, { slot: nextSlot, title, url }]);
    return true;
  }

  async removeQuickAccessByUrl(url: string): Promise<void> {
    await this.setQuickAccess(this.config.quickAccess.filter((i) => i.url !== url));
  }

  /** Botao de "virar acesso rapido" em qualquer aba (viva ou salva): adiciona se ainda nao esta, remove se ja estava. */
  async toggleQuickAccess(title: string, url: string): Promise<void> {
    if (this.isQuickAccess(url)) {
      await this.removeQuickAccessByUrl(url);
    } else {
      await this.addQuickAccess(title, url);
    }
  }

  async updateConfig(patch: Partial<AppConfig>): Promise<void> {
    const res = await send<"CONFIG_UPDATED">({ type: "UPDATE_CONFIG", patch });
    this.config = res.config;
  }

  async setUngroupedEnabled(enabled: boolean): Promise<void> {
    const res = await send<"UNGROUPED_ENABLED_SET">({ type: "SET_UNGROUPED_ENABLED", enabled });
    this.config = res.config;
    this.ungrouped = res.ungrouped;
  }

  async createGroup(name: string): Promise<Group> {
    const res = await send<"GROUP_CREATED">({ type: "CREATE_GROUP", name });
    this.upsertGroup(res.group);
    this.tabsByGroup = { ...this.tabsByGroup, [res.group.id]: [] };
    return res.group;
  }

  async renameGroup(id: string, name: string): Promise<void> {
    const res = await send<"GROUP_RENAMED">({ type: "RENAME_GROUP", id, name });
    if (res.group) this.upsertGroup(res.group);
  }

  async deleteGroup(id: string): Promise<void> {
    await send({ type: "DELETE_GROUP", id });
    this.groups = this.groups.filter((g) => g.id !== id);
    const { [id]: _removed, ...rest } = this.tabsByGroup;
    this.tabsByGroup = rest;
  }

  async setCollapsed(id: string, collapsed: boolean): Promise<void> {
    const res = await send<"GROUP_COLLAPSED_SET">({ type: "SET_GROUP_COLLAPSED", id, collapsed });
    if (res.group) this.upsertGroup(res.group);
  }

  async updateAppearance(id: string, color: string | null, icon: string | null): Promise<void> {
    const res = await send<"GROUP_APPEARANCE_UPDATED">({ type: "UPDATE_GROUP_APPEARANCE", id, color, icon });
    if (res.group) this.upsertGroup(res.group);
  }

  async reorderGroup(id: string, newIndex: number): Promise<void> {
    const res = await send<"GROUP_REORDERED">({ type: "REORDER_GROUP", id, newIndex });
    this.groups = res.groups;
  }

  async removeTab(id: string): Promise<void> {
    const res = await send<"TAB_REMOVED">({ type: "REMOVE_TAB", id });
    this.setTabsSlice(res.groupId, res.tabs);
  }

  async reorderTab(id: string, newIndex: number): Promise<void> {
    const res = await send<"TAB_REORDERED">({ type: "REORDER_TAB", id, newIndex });
    this.setTabsSlice(res.groupId, res.tabs);
  }

  async moveTab(id: string, newGroupId: string | null, newIndex?: number): Promise<void> {
    const res = await send<"TAB_MOVED">({ type: "MOVE_TAB", id, newGroupId, newIndex });
    this.setTabsSlice(res.sourceGroupId, res.sourceTabs);
    this.setTabsSlice(res.destGroupId, res.destTabs);
  }

  async addTab(input: { url: string; title: string; faviconUrl?: string | null; groupId?: string | null }): Promise<void> {
    const res = await send<"TAB_ADDED">({ type: "ADD_TAB", input });
    this.setTabsSlice(input.groupId ?? null, res.tabs);
  }

  /** Adiciona varias abas de uma vez (ex.: salvar uma janela inteira), atualizando so os grupos tocados. */
  async addTabs(
    inputs: { url: string; title: string; faviconUrl?: string | null; groupId?: string | null }[],
  ): Promise<void> {
    for (const input of inputs) {
      const res = await send<"TAB_ADDED">({ type: "ADD_TAB", input });
      this.setTabsSlice(input.groupId ?? null, res.tabs);
    }
  }
}

export const store = new ArfyinStore();
