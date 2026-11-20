import { beforeEach, describe, expect, it } from "vitest";
import {
  drainQueue,
  enqueueGroupDelete,
  enqueueGroupUpsert,
  enqueueTabDelete,
  enqueueTabUpsert,
} from "@/shared/sync";
import { getSyncStatus, listSyncQueue, openArfyinDb, type ArfyinDb } from "@/shared/storage";
import type { DeleteBuilder, DeleteResponse, RemoteDb } from "@/shared/remote";
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
  pinned: false,
  createdAt: 1,
  updatedAt: 1,
};

function fakeRemote(options: { failOn?: string } = {}): { db: RemoteDb; calls: string[] } {
  const calls: string[] = [];
  const ok = () => Promise.resolve({ error: null });
  const fail = () => Promise.resolve({ error: { message: "network down" } });

  const remote: RemoteDb = {
    from(table) {
      return {
        upsert(row: object) {
          const key = `upsert:${table}:${(row as { id: string }).id}`;
          calls.push(key);
          return options.failOn === key ? fail() : ok();
        },
        select() {
          throw new Error("not used in sync tests");
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
});
