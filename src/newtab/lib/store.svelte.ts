import { send } from "./client";
import { defaultAppConfig, type AppConfig, type Group, type QuickAccessItem, type SavedTab } from "@/shared/types";

class ArfyinStore {
  groups: Group[] = $state([]);
  tabsByGroup: Record<string, SavedTab[]> = $state({});
  ungrouped: SavedTab[] = $state([]);
  loaded = $state(false);
  config: AppConfig = $state(defaultAppConfig());

  async loadAll(): Promise<void> {
    const groupsRes = await send<"GROUPS">({ type: "LIST_GROUPS" });
    const groups = groupsRes.type === "GROUPS" ? groupsRes.groups : [];

    const tabsByGroup: Record<string, SavedTab[]> = {};
    for (const group of groups) {
      const tabsRes = await send<"TABS">({ type: "LIST_TABS_BY_GROUP", groupId: group.id });
      tabsByGroup[group.id] = tabsRes.type === "TABS" ? tabsRes.tabs : [];
    }

    const ungroupedRes = await send<"TABS">({ type: "LIST_UNGROUPED_TABS" });

    this.groups = groups;
    this.tabsByGroup = tabsByGroup;
    this.ungrouped = ungroupedRes.type === "TABS" ? ungroupedRes.tabs : [];

    const configRes = await send<"CONFIG">({ type: "GET_CONFIG" });
    if (configRes.type === "CONFIG") this.config = configRes.config;

    this.loaded = true;
  }

  async setQuickAccess(quickAccess: QuickAccessItem[]): Promise<void> {
    await send({ type: "SET_QUICK_ACCESS", quickAccess });
    await this.loadAll();
  }

  async createGroup(name: string): Promise<void> {
    await send({ type: "CREATE_GROUP", name });
    await this.loadAll();
  }

  async renameGroup(id: string, name: string): Promise<void> {
    await send({ type: "RENAME_GROUP", id, name });
    await this.loadAll();
  }

  async deleteGroup(id: string): Promise<void> {
    await send({ type: "DELETE_GROUP", id });
    await this.loadAll();
  }

  async setCollapsed(id: string, collapsed: boolean): Promise<void> {
    await send({ type: "SET_GROUP_COLLAPSED", id, collapsed });
    await this.loadAll();
  }

  async updateAppearance(id: string, color: string | null, icon: string | null): Promise<void> {
    await send({ type: "UPDATE_GROUP_APPEARANCE", id, color, icon });
    await this.loadAll();
  }

  async reorderGroup(id: string, newIndex: number): Promise<void> {
    await send({ type: "REORDER_GROUP", id, newIndex });
    await this.loadAll();
  }

  async removeTab(id: string): Promise<void> {
    await send({ type: "REMOVE_TAB", id });
    await this.loadAll();
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    await send({ type: "SET_TAB_PINNED", id, pinned });
    await this.loadAll();
  }

  async reorderTab(id: string, newIndex: number): Promise<void> {
    await send({ type: "REORDER_TAB", id, newIndex });
    await this.loadAll();
  }

  async moveTab(id: string, newGroupId: string | null, newIndex?: number): Promise<void> {
    await send({ type: "MOVE_TAB", id, newGroupId, newIndex });
    await this.loadAll();
  }

  async addTab(input: { url: string; title: string; faviconUrl?: string | null; groupId?: string | null }): Promise<void> {
    await send({ type: "ADD_TAB", input });
    await this.loadAll();
  }

  /** Adiciona varias abas de uma vez (ex.: salvar uma janela inteira) com um unico reload ao final. */
  async addTabs(
    inputs: { url: string; title: string; faviconUrl?: string | null; groupId?: string | null }[],
  ): Promise<void> {
    for (const input of inputs) {
      await send({ type: "ADD_TAB", input });
    }
    await this.loadAll();
  }
}

export const store = new ArfyinStore();
