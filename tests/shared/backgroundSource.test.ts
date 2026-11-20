import { describe, expect, it } from "vitest";
import { extractImageUrls, pickRandom } from "@/shared/backgroundSource";

describe("extractImageUrls", () => {
  it("extrai apenas urls de imagem direta", () => {
    const posts = [
      { data: { url: "https://i.redd.it/foo.jpg" } },
      { data: { url: "https://example.com/artigo" } },
      { data: { url: "https://i.redd.it/bar.png" } },
      { data: { url: "https://i.redd.it/nsfw.jpg", over_18: true } },
    ];
    expect(extractImageUrls(posts)).toEqual([
      "https://i.redd.it/foo.jpg",
      "https://i.redd.it/bar.png",
    ]);
  });

  it("lista vazia retorna lista vazia", () => {
    expect(extractImageUrls([])).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("retorna null para lista vazia", () => {
    expect(pickRandom([])).toBeNull();
  });

  it("retorna um item da lista", () => {
    const items = ["a", "b", "c"];
    expect(items).toContain(pickRandom(items));
  });
});
