import { describe, expect, it } from "vitest";
import { extractImageUrls, extractUnsplashCandidates, pickRandom } from "@/shared/backgroundSource";

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

describe("extractUnsplashCandidates", () => {
  it("extrai url + atribuicao com utm_source/utm_medium", () => {
    const photos = [
      {
        urls: { regular: "https://images.unsplash.com/photo-1.jpg" },
        user: { name: "Annie Spratt", links: { html: "https://unsplash.com/@anniespratt" } },
        links: { download_location: "https://api.unsplash.com/photos/1/download" },
      },
    ];
    const result = extractUnsplashCandidates(photos);
    expect(result).toEqual([
      {
        url: "https://images.unsplash.com/photo-1.jpg",
        attribution: {
          photographerName: "Annie Spratt",
          photographerUrl: "https://unsplash.com/@anniespratt?utm_source=arfyin&utm_medium=referral",
          unsplashUrl: "https://unsplash.com/?utm_source=arfyin&utm_medium=referral",
          downloadLocation: "https://api.unsplash.com/photos/1/download",
        },
      },
    ]);
  });

  it("descarta fotos sem url regular ou sem download_location", () => {
    const photos = [
      { urls: {}, user: {}, links: { download_location: "https://x/download" } },
      { urls: { regular: "https://x/foo.jpg" }, user: {}, links: {} },
    ];
    expect(extractUnsplashCandidates(photos)).toEqual([]);
  });

  it("lista vazia retorna lista vazia", () => {
    expect(extractUnsplashCandidates([])).toEqual([]);
  });
});
