/** Forma minima de um post do Reddit (`/r/{sub}/top.json`), so o que usamos. */
export interface MinimalRedditPost {
  data: {
    url?: string;
    post_hint?: string;
    over_18?: boolean;
    preview?: { images?: Array<{ source?: { width?: number; height?: number } }> };
    thumbnail_width?: number;
    thumbnail_height?: number;
    author?: string;
    subreddit?: string;
    permalink?: string;
  };
}

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

/**
 * Papel de parede em retrato corta muito quando esticado pra cobrir a tela
 * toda (relatado ao vivo pelo usuario) — so landscape (incluindo quadrado)
 * passa. Dimensao vem de `preview.images[0].source` (gerado pelo proprio
 * Reddit pra quase todo post de imagem); cai pro thumbnail como segunda
 * tentativa. Sem NENHUMA dimensao disponivel, deixa passar — preferimos um
 * post ocasionalmente errado a esvaziar o pool de candidatos por falta de
 * metadado.
 */
function isLandscape(post: MinimalRedditPost): boolean {
  const source = post.data.preview?.images?.[0]?.source;
  const width = source?.width ?? post.data.thumbnail_width;
  const height = source?.height ?? post.data.thumbnail_height;
  if (!width || !height) return true;
  return width >= height;
}

/**
 * Credito de uma imagem de background — quem postou/fotografou e pra onde
 * levar o clique (pedido do usuario: credito do Reddit igual ao que ja
 * existia pro Unsplash, com link de verdade pro post original).
 */
export interface BackgroundAttribution {
  kind: "unsplash" | "reddit";
  /** "Nome Sobrenome" (Unsplash) ou "u/username" (Reddit). */
  authorName: string;
  /** Unsplash: perfil do fotografo. Reddit: o POST original (pedido explicito do usuario — "ir lá pro post"). */
  authorUrl: string;
  /** "Unsplash" ou "r/{subreddit}". */
  sourceName: string;
  /** Unsplash: unsplash.com com UTM. Reddit: a home do subreddit. */
  sourceUrl: string;
  /** So Unsplash: URL a chamar (GET) quando a foto for efetivamente usada — guideline da API. */
  downloadLocation?: string;
}

/** Candidato de background com atribuicao opcional (Unsplash/Reddit tem; local nao tem). */
export interface BackgroundCandidate {
  url: string;
  attribution?: BackgroundAttribution;
}

/**
 * Extrai candidatos de imagem de uma listagem do Reddit, ignorando NSFW e
 * posts que nao sao imagem direta (ex.: links externos, texto, video).
 * Prefere paisagem, mas NUNCA deixa o pool vazio por causa disso: bug real
 * relatado ao vivo — o subreddit "anime" e quase todo arte de personagem em
 * retrato, filtrar por paisagem ali zerava os 25 posts da listagem inteira e
 * a tela ficava preta (nenhum candidato = `background-image: none`). Credito
 * (autor + link pro post) incluido quando o post tem `author`/`permalink` —
 * pedido do usuario, mesmo conceito que ja existia pro Unsplash. Funcao
 * pura — testavel sem fetch real.
 */
export function extractImageUrls(posts: MinimalRedditPost[]): BackgroundCandidate[] {
  const valid = posts.filter(
    (post) => !post.data.over_18 && typeof post.data.url === "string" && IMAGE_EXTENSION.test(post.data.url),
  );
  const landscape = valid.filter(isLandscape);
  return (landscape.length > 0 ? landscape : valid).map((post) => {
    const { url, author, subreddit, permalink } = post.data;
    const attribution: BackgroundAttribution | undefined =
      author && permalink
        ? {
            kind: "reddit",
            authorName: `u/${author}`,
            authorUrl: `https://www.reddit.com${permalink}`,
            sourceName: subreddit ? `r/${subreddit}` : "Reddit",
            sourceUrl: subreddit ? `https://www.reddit.com/r/${subreddit}` : "https://www.reddit.com",
          }
        : undefined;
    return { url: url as string, attribution };
  });
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** Forma minima de uma foto retornada por `api.unsplash.com/photos/random`. */
export interface MinimalUnsplashPhoto {
  urls: { regular?: string };
  user: { name?: string; links?: { html?: string } };
  links: { download_location?: string };
}

const UNSPLASH_APP_NAME = "arfyin";

/** Guideline oficial da Unsplash: todo link de atribuicao leva utm_source/utm_medium. */
function withUnsplashUtm(url: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", UNSPLASH_APP_NAME);
  u.searchParams.set("utm_medium", "referral");
  return u.toString();
}

/**
 * Extrai candidatos de background de uma resposta do Unsplash, com atribuicao.
 * Funcao pura — testavel sem fetch real.
 */
export function extractUnsplashCandidates(photos: MinimalUnsplashPhoto[]): BackgroundCandidate[] {
  return photos
    .filter((p) => typeof p.urls.regular === "string" && typeof p.links.download_location === "string")
    .map((p) => ({
      url: p.urls.regular as string,
      attribution: {
        kind: "unsplash",
        authorName: p.user.name ?? "Unsplash",
        authorUrl: withUnsplashUtm(p.user.links?.html ?? "https://unsplash.com"),
        sourceName: "Unsplash",
        sourceUrl: withUnsplashUtm("https://unsplash.com/"),
        downloadLocation: p.links.download_location as string,
      },
    }));
}
