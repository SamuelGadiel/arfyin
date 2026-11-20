import { describe, expect, it } from "vitest";
import {
  pullGroups,
  pullTabsByGroup,
  pushGroup,
  pushTab,
  type DeleteBuilder,
  type RemoteDb,
  type SelectBuilder,
  type SelectResponse,
} from "@/shared/remote";
import type { Group, SavedTab } from "@/shared/types";

const group: Group = {
  id: "g1",
  name: "Jellyfin",
  color: "#ff0000",
  icon: "tv",
  order: 0,
  collapsed: false,
  createdAt: 1000,
  updatedAt: 2000,
};

const tab: SavedTab = {
  id: "t1",
  groupId: "g1",
  url: "https://jellyfin.org",
  title: "Jellyfin",
  faviconUrl: "https://jellyfin.org/favicon.ico",
  order: 0,
  pinned: true,
  createdAt: 1000,
  updatedAt: 2000,
};

function fakeDb(overrides: Partial<Record<"groups" | "tabs", unknown[]>> = {}): {
  db: RemoteDb;
  upserts: object[];
} {
  const upserts: object[] = [];
  const rows: Record<string, unknown[]> = { groups: [], tabs: [], ...overrides };

  const db: RemoteDb = {
    from(table) {
      return {
        upsert(row) {
          upserts.push(row);
          return Promise.resolve({ error: null });
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
          const builder: DeleteBuilder = {
            eq() {
              return builder;
            },
            then(onFulfilled, onRejected) {
              return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
            },
          };
          return builder;
        },
      };
    },
  };

  return { db, upserts };
}

describe("remote: groups", () => {
  it("pushGroup envia o grupo convertido para o formato da tabela", async () => {
    const { db, upserts } = fakeDb();
    await pushGroup(db, "user-1", group);

    expect(upserts).toEqual([
      {
        id: "g1",
        user_id: "user-1",
        name: "Jellyfin",
        color: "#ff0000",
        icon: "tv",
        order: 0,
        collapsed: false,
        created_at: new Date(1000).toISOString(),
        updated_at: new Date(2000).toISOString(),
      },
    ]);
  });

  it("pullGroups converte as linhas de volta para o formato local", async () => {
    const { db } = fakeDb({
      groups: [
        {
          id: "g1",
          user_id: "user-1",
          name: "Jellyfin",
          color: "#ff0000",
          icon: "tv",
          order: 0,
          collapsed: false,
          created_at: new Date(1000).toISOString(),
          updated_at: new Date(2000).toISOString(),
        },
      ],
    });

    const groups = await pullGroups(db, "user-1");
    expect(groups).toEqual([group]);
  });

  it("pullGroups retorna lista vazia quando nao ha dados", async () => {
    const { db } = fakeDb();
    expect(await pullGroups(db, "user-1")).toEqual([]);
  });
});

describe("remote: tabs", () => {
  it("pushTab envia a aba convertida para o formato da tabela", async () => {
    const { db, upserts } = fakeDb();
    await pushTab(db, "user-1", tab);

    expect(upserts).toEqual([
      {
        id: "t1",
        user_id: "user-1",
        group_id: "g1",
        url: "https://jellyfin.org",
        title: "Jellyfin",
        favicon_url: "https://jellyfin.org/favicon.ico",
        order: 0,
        pinned: true,
        created_at: new Date(1000).toISOString(),
        updated_at: new Date(2000).toISOString(),
      },
    ]);
  });

  it("pullTabsByGroup filtra por grupo e usuario, convertendo de volta", async () => {
    const { db } = fakeDb({
      tabs: [
        {
          id: "t1",
          user_id: "user-1",
          group_id: "g1",
          url: "https://jellyfin.org",
          title: "Jellyfin",
          favicon_url: "https://jellyfin.org/favicon.ico",
          order: 0,
          pinned: true,
          created_at: new Date(1000).toISOString(),
          updated_at: new Date(2000).toISOString(),
        },
        {
          id: "t2",
          user_id: "user-1",
          group_id: "outro-grupo",
          url: "https://outro.com",
          title: "Outro",
          favicon_url: null,
          order: 0,
          pinned: false,
          created_at: new Date(1000).toISOString(),
          updated_at: new Date(2000).toISOString(),
        },
      ],
    });

    const tabs = await pullTabsByGroup(db, "user-1", "g1");
    expect(tabs).toEqual([tab]);
  });
});
