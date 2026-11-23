import { beforeEach, describe, expect, it } from "vitest";
import {
  drainQueue,
  enqueueGroupDelete,
  enqueueGroupUpsert,
  enqueueTabDelete,
  enqueueTabUpsert,
  fullSync,
  pullAndMerge,
} from "@/shared/sync";
import {
  createGroup,
  getSyncStatus,
  listGroups,
  listSyncQueue,
  listTabsByGroup,
  openArfyinDb,
  type ArfyinDb,
} from "@/shared/storage";
import type { DeleteBuilder, DeleteResponse, RemoteDb, SelectBuilder, SelectResponse } from "@/shared/remote";
import type { Group, SavedTab } from "@/shared/types";

let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

const group: Group = {
  id: "g1",
  name: "Jellyfin",
  color: null,
  icon: null,
  order: 0,
  collapsed: false,
  createdAt: 1,
  updatedAt: 1,
};

const tab: SavedTab = {
  id: "t1",
  groupId: "g1",
  url: "https://jellyfin.org",
  title: "Jellyfin",
  faviconUrl: null,
  order: 0,
  createdAt: 1,
  updatedAt: 1,
};

function fakeRemote(
  options: {
    failOn?: string;
    failMessage?: string;
    rows?: Partial<Record<"groups" | "tabs" | "config", unknown[]>>;
  } = {},
): { db: RemoteDb; calls: string[] } {
  const calls: string[] = [];
  const ok = () => Promise.resolve({ error: null });
  const fail = () => Promise.resolve({ error: { message: options.failMessage ?? "network down" } });
  const rows: Record<string, unknown[]> = { groups: [], tabs: [], config: [], ...options.rows };

  const remote: RemoteDb = {
    from(table) {
      return {
        upsert(row: object) {
          const key = `upsert:${table}:${(row as { id: string }).id}`;
          calls.push(key);
          return options.failOn === key ? fail() : ok();
        },
        select() {
          const filters: Array<[string, unknown]> = [];
          const builder: SelectBuilder = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return builder;
            },
            then(onFulfilled, onRejected) {
              const data = rows[table]!.filter((row) =>
                filters.every(([col, val]) => (row as Record<string, unknown>)[col] === val),
              ) as Record<string, unknown>[];
              const response: SelectResponse = { data, error: null };
              return Promise.resolve(response).then(onFulfilled, onRejected);
            },
          };
          return builder;
        },
        delete() {
          let key = `delete:${table}`;
          const builder: DeleteBuilder = {
            eq(_column: string, value: unknown) {
              key += `:${value}`;
              return builder;
            },
            then(onFulfilled, onRejected) {
              calls.push(key);
              const response: DeleteResponse = options.failOn === key ? { error: { message: "network down" } } : { error: null };
              return Promise.resolve(response).then(onFulfilled, onRejected);
            },
          };
          return builder;
        },
      };
    },
  };

  return { db: remote, calls };
}

describe("sync queue", () => {
  it("enfileira upserts e deletes de grupo/aba", async () => {
    await enqueueGroupUpsert(db, group);
    await enqueueTabUpsert(db, tab);
    await enqueueGroupDelete(db, "g2");
    await enqueueTabDelete(db, "t2");

    const queue = await listSyncQueue(db);
    expect(queue).toHaveLength(4);
    expect(queue.map((op) => op.op)).toEqual(["upsert", "upsert", "delete", "delete"]);
  });

  it("drainQueue sem nada pendente marca idle", async () => {
    const { db: remote } = fakeRemote();
    const status = await drainQueue(db, remote, "user-1");
    expect(status.state).toBe("idle");
  });

  it("drainQueue processa a fila e esvazia em caso de sucesso total", async () => {
    await enqueueGroupUpsert(db, group);
    await enqueueTabUpsert(db, tab);

    const { db: remote, calls } = fakeRemote();
    const status = await drainQueue(db, remote, "user-1");

    expect(status.state).toBe("idle");
    expect(await listSyncQueue(db)).toEqual([]);
    expect(calls).toEqual(["upsert:groups:g1", "upsert:tabs:t1"]);
  });

  it("drainQueue para no primeiro erro e preserva o resto da fila", async () => {
    await enqueueGroupUpsert(db, group);
    await enqueueTabUpsert(db, tab);

    const { db: remote } = fakeRemote({ failOn: "upsert:groups:g1" });
    const status = await drainQueue(db, remote, "user-1");

    expect(status.state).toBe("unreachable");
    expect(status.lastError).toContain("network down");

    const remaining = await listSyncQueue(db);
    expect(remaining).toHaveLength(2);
  });

  it("deletar grupo enfileira so a deleção do grupo (cascade fica por conta do Postgres)", async () => {
    await enqueueGroupDelete(db, "g1");
    const { db: remote, calls } = fakeRemote();
    await drainQueue(db, remote, "user-1");
    expect(calls).toEqual(["delete:groups:g1:user-1"]);
  });

  it("getSyncStatus reflete o ultimo resultado persistido", async () => {
    await enqueueGroupUpsert(db, group);
    const { db: remote } = fakeRemote({ failOn: "upsert:groups:g1" });
    await drainQueue(db, remote, "user-1");

    const status = await getSyncStatus(db);
    expect(status.state).toBe("unreachable");
  });

  it("erro de dado (nao-transiente) nao trava os itens seguintes da fila", async () => {
    const tab2: SavedTab = { ...tab, id: "t2" };
    await enqueueTabUpsert(db, tab); // vai falhar com erro de dado
    await enqueueTabUpsert(db, tab2); // deve continuar e ter sucesso

    const { db: remote, calls } = fakeRemote({
      failOn: "upsert:tabs:t1",
      failMessage: "duplicate key value violates unique constraint",
    });
    const status = await drainQueue(db, remote, "user-1");

    // continua idle (a fila nao travou), mas o erro de dado fica registrado
    expect(status.state).toBe("idle");
    expect(status.lastError).toContain("duplicate key");
    expect(calls).toEqual(["upsert:tabs:t1", "upsert:tabs:t2"]);

    // t1 continua na fila (operacao nao foi descartada), t2 foi drenado
    const remaining = await listSyncQueue(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.entityId).toBe("t1");
  });
});

describe("pullAndMerge / fullSync", () => {
  const remoteGroupRow = {
    id: "g1",
    user_id: "user-1",
    name: "Jellyfin (remoto)",
    color: null,
    icon: null,
    order: 0,
    collapsed: false,
    created_at: new Date(1000).toISOString(),
    updated_at: new Date(9999).toISOString(),
  };

  const remoteTabRow = {
    id: "t1",
    user_id: "user-1",
    group_id: "g1",
    url: "https://jellyfin.org",
    title: "Jellyfin (remoto)",
    favicon_url: null,
    order: 0,
    created_at: new Date(1000).toISOString(),
    updated_at: new Date(9999).toISOString(),
  };

  it("traz grupo/aba que so existiam no Supabase para o IndexedDB local", async () => {
    const { db: remote } = fakeRemote({ rows: { groups: [remoteGroupRow], tabs: [remoteTabRow] } });

    await pullAndMerge(db, remote, "user-1");

    const groups = await listGroups(db);
    expect(groups.map((g) => g.id)).toEqual(["g1"]);
    expect(groups[0]?.name).toBe("Jellyfin (remoto)");

    const tabs = await listTabsByGroup(db, "g1");
    expect(tabs.map((t) => t.id)).toEqual(["t1"]);
  });

  it("nao sobrescreve uma mudanca local mais recente que o registro remoto", async () => {
    // registro local (mais novo) ja existe no IDB com o mesmo id do remoto
    const tx = db.transaction("groups", "readwrite");
    await tx.objectStore("groups").put({ ...group, id: "g1", name: "Local (mais novo)", updatedAt: 999_999_999 });
    await tx.done;

    const { db: remote } = fakeRemote({ rows: { groups: [remoteGroupRow] } });
    await pullAndMerge(db, remote, "user-1");

    const groups = await listGroups(db);
    expect(groups[0]?.name).toBe("Local (mais novo)");
  });

  it("fullSync mescla o remoto e depois drena a fila local pendente", async () => {
    const localGroup = await createGroup(db, "Grupo local");
    await enqueueGroupUpsert(db, localGroup);
    const { db: remote, calls } = fakeRemote({ rows: { groups: [remoteGroupRow] } });

    await fullSync(db, remote, "user-1");

    // puxou o grupo remoto...
    expect((await listGroups(db)).map((g) => g.id).sort()).toEqual([localGroup.id, "g1"].sort());
    // ...e drenou o que estava pendente localmente
    expect(calls).toContain(`upsert:groups:${localGroup.id}`);
    expect(await listSyncQueue(db)).toEqual([]);
  });
});
