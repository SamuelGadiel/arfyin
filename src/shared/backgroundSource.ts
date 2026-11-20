/** Forma minima de um post do Reddit (`/r/{sub}/top.json`), so o que usamos. */
export interface MinimalRedditPost {
  data: {
    url?: string;
    post_hint?: string;
    over_18?: boolean;
  };
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

/**
 * Extrai URLs de imagem de uma listagem do Reddit, ignorando NSFW e posts
 * que nao sao imagem direta (ex.: links externos, texto, video). Funcao pura
 * — testavel sem fetch real.
 */
export function extractImageUrls(posts: MinimalRedditPost[]): string[] {
  return posts
    .filter((post) => !post.data.over_18)
    .map((post) => post.data.url)
    .filter((url): url is string => typeof url === "string" && IMAGE_EXTENSION.test(url));
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}
