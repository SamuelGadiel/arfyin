/** Forma minima de um post do Reddit (`/r/{sub}/top.json`), so o que usamos. */
export interface MinimalRedditPost {
  data: {
    url?: string;
    post_hint?: string;
    over_18?: boolean;
    preview?: { images?: Array<{ source?: { width?: number; height?: number } }> };
    thumbnail_width?: number;
    thumbnail_height?: number;
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
 * Extrai URLs de imagem de uma listagem do Reddit, ignorando NSFW, posts
 * que nao sao imagem direta (ex.: links externos, texto, video) e imagens em
 * retrato. Funcao pura — testavel sem fetch real.
 */
export function extractImageUrls(posts: MinimalRedditPost[]): string[] {
  return posts
    .filter((post) => !post.data.over_18 && isLandscape(post))
    .map((post) => post.data.url)
    .filter((url): url is string => typeof url === "string" && IMAGE_EXTENSION.test(url));
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** Candidato de background com atribuicao opcional (Unsplash exige; reddit/local nao tem). */
export interface BackgroundCandidate {
  url: string;
  attribution?: {
    photographerName: string;
    photographerUrl: string;
    /** Link genérico para unsplash.com (com UTM), conforme formato oficial de atribuição. */
    unsplashUrl: string;
    /** URL a chamar (GET) quando a foto for efetivamente usada — guideline da Unsplash API. */
    downloadLocation: string;
  };
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
        photographerName: p.user.name ?? "Unsplash",
        photographerUrl: withUnsplashUtm(p.user.links?.html ?? "https://unsplash.com"),
        unsplashUrl: withUnsplashUtm("https://unsplash.com/"),
        downloadLocation: p.links.download_location as string,
      },
    }));
}
