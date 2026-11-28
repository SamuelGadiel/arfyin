import type { ArfyinDb } from "@/shared/storage";
import {
  getAsset,
  deleteAsset,
  enqueueBackgroundPrefetch,
  popBackgroundPrefetch,
  countBackgroundPrefetch,
  clearBackgroundPrefetchExcept,
} from "@/shared/storage";
import { fetchFreshCandidates, downloadAndResizeImage, type BgSpec } from "@/shared/backgroundFetch";
import type { BackgroundAttribution } from "@/shared/backgroundSource";

/** Quantas imagens mantemos sempre prontas (baixadas+redimensionadas) por especificacao de fonte. */
const POOL_SIZE = 5;

/**
 * Consome o proximo item pronto da fila (se houver) e dispara reposicao em
 * paralelo (fire-and-forget) — a aba NUNCA espera a reposicao, so o pop em
 * si (leitura local de um blob ja baixado, tipicamente alguns ms).
 */
export async function popAndRefill(
  db: ArfyinDb,
  specKey: string,
  spec: BgSpec,
  targetWidth: number,
  targetHeight: number,
): Promise<{ blob: Blob | null; sourceUrl?: string; attribution?: BackgroundAttribution }> {
  // Troca de fonte/parametros: descarta filas de especificacoes antigas (e
  // seus blobs) antes de mexer na fila atual — evita acumular lixo
  // indefinidamente conforme o usuario muda de subreddit/topico ao longo do
  // tempo.
  void clearBackgroundPrefetchExcept(db, specKey);

  const item = await popBackgroundPrefetch(db, specKey);
  let blob: Blob | null = null;
  if (item) {
    blob = await getAsset(db, item.id);
    await deleteAsset(db, item.id);
  }

  // Fire-and-forget: a resposta pro cliente nao espera isto.
  void refillQueue(db, specKey, spec, targetWidth, targetHeight);

  return { blob, sourceUrl: item?.sourceUrl, attribution: item?.attribution };
}

async function refillQueue(
  db: ArfyinDb,
  specKey: string,
  spec: BgSpec,
  targetWidth: number,
  targetHeight: number,
): Promise<void> {
  let count = await countBackgroundPrefetch(db, specKey);
  if (count >= POOL_SIZE) return;

  let candidates = await fetchFreshCandidates(spec);
  if (candidates.length === 0) return;

  const tried = new Set<string>();
  // Nunca mais tentativas que candidatos disponiveis — evita loop infinito
  // se todos os downloads falharem (rede instavel, CDN fora do ar, etc).
  let attempts = 0;
  const maxAttempts = candidates.length * 2;

  while (count < POOL_SIZE && attempts < maxAttempts) {
    attempts++;
    const pending = candidates.filter((c) => !tried.has(c.url));
    if (pending.length === 0) break;
    const candidate = pending[Math.floor(Math.random() * pending.length)]!;
    tried.add(candidate.url);

    const resized = await downloadAndResizeImage(candidate.url, targetWidth, targetHeight);
    if (resized) {
      await enqueueBackgroundPrefetch(db, specKey, resized, candidate.url, candidate.attribution);
      count++;
    }
  }
}
