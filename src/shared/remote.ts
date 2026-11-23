import type { AppConfig, Group, SavedTab } from "./types";

/**
 * Forma minima do que usamos do cliente supabase-js, pra poder testar com um fake
 * sem bater na rede real. O client real (`@supabase/supabase-js`) satisfaz essa
 * forma estruturalmente — nao precisa de adaptador em producao.
 */
export interface SelectResponse {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

export interface SelectBuilder extends PromiseLike<SelectResponse> {
  eq(column: string, value: unknown): SelectBuilder;
}

export interface DeleteResponse {
  error: { message: string } | null;
}

export interface DeleteBuilder extends PromiseLike<DeleteResponse> {
  eq(column: string, value: unknown): DeleteBuilder;
}

export interface RemoteDb {
  from(table: "groups" | "tabs" | "config"): {
    upsert(row: object): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): SelectBuilder;
    delete(): DeleteBuilder;
  };
}

interface GroupRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  order: number;
  collapsed: boolean;
  created_at: string;
  updated_at: string;
}

interface TabRow {
  id: string;
  user_id: string;
  group_id: string | null;
  url: string;
  title: string;
  favicon_url: string | null;
  order: number;
  created_at: string;
  updated_at: string;
}

function groupToRow(userId: string, group: Group): GroupRow {
  return {
    id: group.id,
    user_id: userId,
    name: group.name,
    color: group.color,
    icon: group.icon,
    order: group.order,
    collapsed: group.collapsed,
    created_at: new Date(group.createdAt).toISOString(),
    updated_at: new Date(group.updatedAt).toISOString(),
  };
}

function rowToGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    order: row.order,
    collapsed: row.collapsed,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function tabToRow(userId: string, tab: SavedTab): TabRow {
  return {
    id: tab.id,
    user_id: userId,
    group_id: tab.groupId,
    url: tab.url,
    title: tab.title,
    favicon_url: tab.faviconUrl,
    order: tab.order,
    created_at: new Date(tab.createdAt).toISOString(),
    updated_at: new Date(tab.updatedAt).toISOString(),
  };
}

function rowToTab(row: TabRow): SavedTab {
  return {
    id: row.id,
    groupId: row.group_id,
    url: row.url,
    title: row.title,
    faviconUrl: row.favicon_url,
    order: row.order,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export async function pushGroup(db: RemoteDb, userId: string, group: Group): Promise<void> {
  const { error } = await db.from("groups").upsert(groupToRow(userId, group));
  if (error) throw new Error(`Falha ao sincronizar grupo: ${error.message}`);
}

export async function pullGroups(db: RemoteDb, userId: string): Promise<Group[]> {
  const { data, error } = await db.from("groups").select("*").eq("user_id", userId);
  if (error) throw new Error(`Falha ao buscar grupos: ${error.message}`);
  return (data ?? []).map((row) => rowToGroup(row as unknown as GroupRow));
}

export async function pushTab(db: RemoteDb, userId: string, tab: SavedTab): Promise<void> {
  const { error } = await db.from("tabs").upsert(tabToRow(userId, tab));
  if (error) throw new Error(`Falha ao sincronizar aba: ${error.message}`);
}

export async function deleteRemoteGroup(db: RemoteDb, userId: string, id: string): Promise<void> {
  const { error } = await db.from("groups").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`Falha ao deletar grupo: ${error.message}`);
}

export async function deleteRemoteTab(db: RemoteDb, userId: string, id: string): Promise<void> {
  const { error } = await db.from("tabs").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`Falha ao deletar aba: ${error.message}`);
}

export async function pullTabsByGroup(
  db: RemoteDb,
  userId: string,
  groupId: string,
): Promise<SavedTab[]> {
  const { data, error } = await db
    .from("tabs")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw new Error(`Falha ao buscar abas: ${error.message}`);
  return (data ?? []).map((row) => rowToTab(row as unknown as TabRow));
}

/** Todas as abas do usuario, independente de grupo (inclui abas soltas) — usado no bootstrap/merge do login. */
export async function pullAllTabs(db: RemoteDb, userId: string): Promise<SavedTab[]> {
  const { data, error } = await db.from("tabs").select("*").eq("user_id", userId);
  if (error) throw new Error(`Falha ao buscar abas: ${error.message}`);
  return (data ?? []).map((row) => rowToTab(row as unknown as TabRow));
}

interface ConfigRow {
  user_id: string;
  data: AppConfig;
  updated_at: string;
}

export async function pushConfig(db: RemoteDb, userId: string, config: AppConfig): Promise<void> {
  const row: ConfigRow = { user_id: userId, data: config, updated_at: new Date(config.updatedAt).toISOString() };
  const { error } = await db.from("config").upsert(row);
  if (error) throw new Error(`Falha ao sincronizar config: ${error.message}`);
}

/** `null` quando o usuario ainda nao tem config nenhuma salva no Supabase (conta nova). */
export async function pullConfig(db: RemoteDb, userId: string): Promise<AppConfig | null> {
  const { data, error } = await db.from("config").select("*").eq("user_id", userId);
  if (error) throw new Error(`Falha ao buscar config: ${error.message}`);
  const row = (data?.[0] as unknown as ConfigRow | undefined) ?? null;
  if (!row) return null;
  return { ...row.data, updatedAt: new Date(row.updated_at).getTime() };
}
