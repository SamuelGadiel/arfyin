import {
  extractImageUrls,
  extractUnsplashCandidates,
  type BackgroundCandidate,
  type MinimalRedditPost,
  type MinimalUnsplashPhoto,
} from "./backgroundSource";
import type { BackgroundRotationMode, BackgroundSourceKind } from "./types";

/**
 * Busca de candidatos (reddit/unsplash) e download/redimensionamento de
 * imagens — compartilhado entre a new-tab (pool de candidatos pra
 * next()/prev() manual, ver backgroundState.svelte.ts) e o service worker
 * (fila de pré-fetch consumida na abertura de cada aba, ver
 * src/background/backgroundPrefetch.ts). Roda em ambos os contextos (DOM e
 * service worker) — por isso nenhuma API aqui pode depender de `window`/DOM
 * (fetch, createImageBitmap, OffscreenCanvas são todas Worker-compatible).
 */

export interface BgSpec {
  source: BackgroundSourceKind;
  subreddits: string[];
  unsplashTopics: string[];
  localAssetIds: string[];
  pausedKey: string | null;
  rotationMode: BackgroundRotationMode;
  frequencyMinutes: number;
  timedStartedAt: number;
}

/** Assinatura estavel de "o que buscar" (sem pausedKey/rotationMode/etc, que so afetam "o que mostrar"). */
export function computeSpecKey(spec: Pick<BgSpec, "source" | "subreddits" | "unsplashTopics" | "localAssetIds">): string {
  return JSON.stringify([spec.source, spec.subreddits, spec.unsplashTopics, spec.localAssetIds]);
}

export function parseBgSpec(key: string): BgSpec {
  const [
    source,
    subreddits,
    unsplashTopics,
    localAssetIds,
    pausedKey,
    rotationMode,
    frequencyMinutes,
    timedStartedAt,
  ] = JSON.parse(key) as [
    BackgroundSourceKind,
    string[],
    string[],
    string[],
    string | null,
    BackgroundRotationMode,
    number,
    number,
  ];
  return {
    source,
    subreddits,
    unsplashTopics,
    localAssetIds,
    pausedKey,
    rotationMode,
    frequencyMinutes,
    timedStartedAt,
  };
}

async function fetchUnsplashRandom(topic: string, accessKey: string, landscapeOnly: boolean) {
  const orientationParam = landscapeOnly ? "&orientation=landscape" : "";
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(topic)}&count=10${orientationParam}`,
    { headers: { Authorization: `Client-ID ${accessKey}` } },
  );
  const photos = (await res.json()) as MinimalUnsplashPhoto[];
  return extractUnsplashCandidates(Array.isArray(photos) ? photos : []);
}

/**
 * Busca candidatos de TODAS as fontes configuradas (todos os subreddits ou
 * topicos, nao so um sorteado) e combina — e isso que faz "ciclar entre
 * varios ao mesmo tempo" funcionar de verdade: o pool de candidatos passa a
 * conter imagens de cada um deles, em vez de travar numa fonte escolhida ao
 * acaso a cada atualizacao de cache.
 */
export async function fetchFreshCandidates(spec: BgSpec): Promise<BackgroundCandidate[]> {
  if (spec.source === "reddit" && spec.subreddits.length > 0) {
    const perSubreddit = await Promise.all(
      spec.subreddits.map(async (subreddit) => {
        try {
          const res = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?limit=25&t=week`);
          const json = await res.json();
          const posts = (json?.data?.children ?? []) as MinimalRedditPost[];
          return extractImageUrls(posts);
        } catch {
          return [];
        }
      }),
    );
    return perSubreddit.flat();
  }
  if (spec.source === "unsplash" && spec.unsplashTopics.length > 0) {
    const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (!accessKey) return [];
    const perTopic = await Promise.all(
      spec.unsplashTopics.map(async (topic) => {
        try {
          // `orientation=landscape` e parametro oficial da API (evita papel de
          // parede em retrato cortando muito ao esticar pra tela cheia — mesmo
          // ajuste feito no lado do reddit em backgroundSource.ts). Mesma
          // rede de seguranca do lado do reddit: se o topico nao tiver NENHUM
          // resultado em paisagem (raro, mas possivel pra topicos bem
          // especificos), refaz sem o parametro em vez de deixar o pool vazio.
          const landscapeOnly = await fetchUnsplashRandom(topic, accessKey, true);
          if (landscapeOnly.length > 0) return landscapeOnly;
          return await fetchUnsplashRandom(topic, accessKey, false);
        } catch {
          return [];
        }
      }),
    );
    return perTopic.flat();
  }
  return [];
}

/**
 * Baixa a imagem de verdade (nao so a URL) e a redimensiona para no maximo
 * `maxWidth`x`maxHeight` (mantendo proporcao) antes de devolver o blob final
 * — pedido explicito do usuario apos confirmarmos que o pico de memoria do
 * papel de parede e proporcional ao tamanho ORIGINAL da imagem (6000x4000 do
 * Reddit chega a ~96MB so de decodificacao), nao ao tamanho real exibido na
 * tela. Se a imagem original ja for menor que o alvo, devolve o blob original
 * sem reprocessar (nada a ganhar redimensionando pra cima).
 */
export async function downloadAndResizeImage(
  url: string,
  maxWidth: number,
  maxHeight: number,
): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const original = await res.blob();
    const bitmap = await createImageBitmap(original);
    try {
      const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
      if (scale >= 1) return original;
      const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
      const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) return original;
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/**
 * `chrome.runtime.sendMessage`/`sendResponse` serializa a mensagem via JSON
 * puro (nao structured clone) — confirmado ao vivo que nem `Blob` nem
 * `ArrayBuffer` sobrevivem ao round-trip (chegam como `{}` vazio do outro
 * lado, sem erro nenhum). Base64 (string) e o unico formato que atravessa
 * essa mensageria de forma garantida — usado para transportar o blob da fila
 * de pre-fetch do service worker ate a pagina.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Em chunks (em vez de += char a char) — mais rapido para imagens de
  // varios MB, e sem risco de estourar o limite de argumentos do spread
  // (8192 e um tamanho seguro para qualquer engine).
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
