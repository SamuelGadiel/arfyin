/**
 * Icones via Iconify (api.iconify.design), biblioteca "Hugeicons" (MIT,
 * ~6100 icones stroke 24px — a mesma que o usuario pediu, ja confirmada
 * disponivel no catalogo publico do Iconify). Em vez de empacotar os SVGs no
 * bundle (aumentaria o tamanho do build por uma biblioteca inteira de
 * milhares de icones so pra usar ~15), busca o `body` de cada icone sob
 * demanda e cacheia via Cache Storage API (sobrevive a reloads/novas abas,
 * sem precisar bater na rede de novo pros mesmos icones). A API do Iconify
 * responde com `Access-Control-Allow-Origin: *` — nenhum host_permission
 * novo e necessario no manifest.
 */
const PREFIX = "hugeicons";
const CACHE_NAME = "arfyin-icon-cache-v1";
const LIST_CACHE_KEY = "https://arfyin.local/icon-cache/hugeicons/_all-names";

function iconCacheKey(name: string): string {
  return `https://arfyin.local/icon-cache/${PREFIX}/${name}`;
}

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function readCachedJson<T>(key: string): Promise<T | null> {
  const cache = await openCache();
  if (!cache) return null;
  const res = await cache.match(key);
  if (!res) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeCachedJson(key: string, value: unknown): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  await cache.put(key, new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } }));
}

// Checagem defensiva (nao e um sanitizador completo de SVG — o corpo vem de
// uma API publica confiavel, so uma rede de seguranca barata contra
// comprometimento da API/CDN ou cache envenenado).
function isSafeSvgBody(body: string): boolean {
  return !/<script|on\w+\s*=|javascript:|<foreignobject/i.test(body);
}

const memCache = new Map<string, string | null>();
let pendingNames = new Set<string>();
const pendingWaiters = new Map<string, Array<(body: string | null) => void>>();
let flushScheduled = false;

function resolveWaiters(name: string, body: string | null): void {
  const waiters = pendingWaiters.get(name);
  pendingWaiters.delete(name);
  waiters?.forEach((fn) => fn(body));
}

async function flushBatch(): Promise<void> {
  flushScheduled = false;
  const names = Array.from(pendingNames);
  pendingNames = new Set();
  if (names.length === 0) return;

  const stillMissing: string[] = [];
  await Promise.all(
    names.map(async (name) => {
      const cached = await readCachedJson<{ body: string }>(iconCacheKey(name));
      if (cached?.body) {
        memCache.set(name, cached.body);
        resolveWaiters(name, cached.body);
      } else {
        stillMissing.push(name);
      }
    }),
  );

  if (stillMissing.length === 0) return;

  try {
    const url = `https://api.iconify.design/${PREFIX}.json?icons=${stillMissing.join(",")}`;
    const res = await fetch(url);
    const json = await res.json();
    const icons = (json?.icons ?? {}) as Record<string, { body?: string }>;
    await Promise.all(
      stillMissing.map(async (name) => {
        const rawBody = icons[name]?.body ?? null;
        const body = rawBody && isSafeSvgBody(rawBody) ? rawBody : null;
        memCache.set(name, body);
        if (body) await writeCachedJson(iconCacheKey(name), { body });
        resolveWaiters(name, body);
      }),
    );
  } catch {
    stillMissing.forEach((name) => resolveWaiters(name, null));
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  // Agrupa num unico fetch todos os icones pedidos no mesmo ciclo de
  // renderizacao (varios <Icon> montam ao mesmo tempo) — sem isso seria 1
  // requisicao HTTP por icone.
  queueMicrotask(flushBatch);
}

/** Busca o `body` SVG de um icone (cache em memoria -> Cache Storage -> rede, nessa ordem). */
export function getIconBody(name: string): Promise<string | null> {
  if (memCache.has(name)) return Promise.resolve(memCache.get(name) ?? null);
  return new Promise((resolve) => {
    const waiters = pendingWaiters.get(name) ?? [];
    waiters.push(resolve);
    pendingWaiters.set(name, waiters);
    pendingNames.add(name);
    scheduleFlush();
  });
}

let allNamesPromise: Promise<string[]> | null = null;

/** Lista completa dos nomes de icones da colecao (pra poder navegar/buscar em TODOS eles no seletor). */
export async function listAllIconNames(): Promise<string[]> {
  if (!allNamesPromise) {
    allNamesPromise = (async () => {
      const cached = await readCachedJson<{ names: string[] }>(LIST_CACHE_KEY);
      if (cached?.names?.length) return cached.names;
      const res = await fetch(`https://api.iconify.design/collection?prefix=${PREFIX}`);
      const json = await res.json();
      const names = ([...(json?.uncategorized ?? [])] as string[]).sort((a, b) => a.localeCompare(b));
      if (names.length > 0) await writeCachedJson(LIST_CACHE_KEY, { names });
      return names;
    })();
  }
  return allNamesPromise;
}
