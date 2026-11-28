// @vitest-environment node
//
// Ambiente `node` em vez do `jsdom` padrao do projeto: este arquivo nao usa
// NENHUMA API de DOM, so IndexedDB (via fake-indexeddb). Achado real durante
// a escrita deste teste — `fake-indexeddb` nao consegue clonar
// corretamente um `Blob` do jsdom (retorna um objeto vazio ao ler de volta,
// sem erro), mas clona o `Blob` nativo do Node perfeitamente. Isso NAO afeta
// producao (o Chrome real tem uma implementacao nativa de IndexedDB, madura,
// sem essa peculiaridade) — e um problema isolado da combinacao especifica
// jsdom+fake-indexeddb usada neste projeto de testes.
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearBackgroundPrefetchExcept,
  countBackgroundPrefetch,
  enqueueBackgroundPrefetch,
  getAsset,
  openArfyinDb,
  popBackgroundPrefetch,
  type ArfyinDb,
} from "@/shared/storage";

// ARF-168/172 (fix do flash de fundo): fila de imagens de fundo
// PRE-BAIXADAS (blob real), consumida uma por aba, reposta pelo background.
// Testes puros de storage — a logica de download/redimensionamento/refill
// (src/background/backgroundPrefetch.ts) depende de fetch de rede real, fora
// do escopo de unit test (coberta ao vivo, ver REGISTRO.md).

let db: ArfyinDb;

beforeEach(async () => {
  db = await openArfyinDb(`test-${crypto.randomUUID()}`);
});

function blob(content: string): Blob {
  return new Blob([content], { type: "image/jpeg" });
}

describe("fila de pre-fetch de background", () => {
  it("pop retorna null quando a fila esta vazia", async () => {
    expect(await popBackgroundPrefetch(db, "spec-a")).toBeNull();
  });

  it("enqueue + pop devolve o blob e o metadado corretos", async () => {
    await enqueueBackgroundPrefetch(db, "spec-a", blob("img1"), "https://example.com/1.jpg", {
      kind: "reddit",
      authorName: "u/foo",
      authorUrl: "https://reddit.com/u/foo",
      sourceName: "r/wallpapers",
      sourceUrl: "https://reddit.com/r/wallpapers",
    });

    const item = await popBackgroundPrefetch(db, "spec-a");
    expect(item?.sourceUrl).toBe("https://example.com/1.jpg");
    expect(item?.attribution?.authorName).toBe("u/foo");

    const storedBlob = item ? await getAsset(db, item.id) : null;
    expect(storedBlob?.size).toBe(blob("img1").size);
  });

  it("pop e sempre FIFO (ordem de insercao), nunca LIFO", async () => {
    await enqueueBackgroundPrefetch(db, "spec-a", blob("img1"), "https://example.com/1.jpg");
    await enqueueBackgroundPrefetch(db, "spec-a", blob("img2"), "https://example.com/2.jpg");
    await enqueueBackgroundPrefetch(db, "spec-a", blob("img3"), "https://example.com/3.jpg");

    const first = await popBackgroundPrefetch(db, "spec-a");
    const second = await popBackgroundPrefetch(db, "spec-a");
    const third = await popBackgroundPrefetch(db, "spec-a");

    expect([first?.sourceUrl, second?.sourceUrl, third?.sourceUrl]).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
      "https://example.com/3.jpg",
    ]);
  });

  it("pop remove o item consumido — nao aparece de novo numa proxima chamada", async () => {
    await enqueueBackgroundPrefetch(db, "spec-a", blob("img1"), "https://example.com/1.jpg");
    await popBackgroundPrefetch(db, "spec-a");
    expect(await popBackgroundPrefetch(db, "spec-a")).toBeNull();
  });

  it("filas de specKeys diferentes sao totalmente isoladas (ex.: trocar de subreddit)", async () => {
    await enqueueBackgroundPrefetch(db, "spec-a", blob("imgA"), "https://example.com/a.jpg");
    await enqueueBackgroundPrefetch(db, "spec-b", blob("imgB"), "https://example.com/b.jpg");

    expect(await countBackgroundPrefetch(db, "spec-a")).toBe(1);
    expect(await countBackgroundPrefetch(db, "spec-b")).toBe(1);

    const poppedA = await popBackgroundPrefetch(db, "spec-a");
    expect(poppedA?.sourceUrl).toBe("https://example.com/a.jpg");
    expect(await countBackgroundPrefetch(db, "spec-b")).toBe(1); // intocado
  });

  it("clearBackgroundPrefetchExcept remove filas antigas e preserva a atual", async () => {
    await enqueueBackgroundPrefetch(db, "spec-old", blob("old"), "https://example.com/old.jpg");
    await enqueueBackgroundPrefetch(db, "spec-new", blob("new"), "https://example.com/new.jpg");

    await clearBackgroundPrefetchExcept(db, "spec-new");

    expect(await countBackgroundPrefetch(db, "spec-old")).toBe(0);
    expect(await countBackgroundPrefetch(db, "spec-new")).toBe(1);
  });

  it("count reflete enqueues e pops corretamente", async () => {
    expect(await countBackgroundPrefetch(db, "spec-a")).toBe(0);
    await enqueueBackgroundPrefetch(db, "spec-a", blob("1"), "https://example.com/1.jpg");
    await enqueueBackgroundPrefetch(db, "spec-a", blob("2"), "https://example.com/2.jpg");
    expect(await countBackgroundPrefetch(db, "spec-a")).toBe(2);
    await popBackgroundPrefetch(db, "spec-a");
    expect(await countBackgroundPrefetch(db, "spec-a")).toBe(1);
  });

  it("pops concorrentes (duas abas abrindo ao mesmo tempo) nunca retornam o mesmo item", async () => {
    await enqueueBackgroundPrefetch(db, "spec-a", blob("1"), "https://example.com/1.jpg");
    await enqueueBackgroundPrefetch(db, "spec-a", blob("2"), "https://example.com/2.jpg");

    const [a, b] = await Promise.all([popBackgroundPrefetch(db, "spec-a"), popBackgroundPrefetch(db, "spec-a")]);

    expect(a?.sourceUrl).not.toBe(b?.sourceUrl);
    expect([a?.sourceUrl, b?.sourceUrl].sort()).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });
});
