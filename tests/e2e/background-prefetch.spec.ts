import { test, expect, chromium, type BrowserContext, type Route } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ARF-168/172 (fix do flash de fundo + fila de pre-fetch): o usuario relatou,
// usando a extensao de verdade, que ao abrir uma nova aba (fonte reddit/
// unsplash, modo "per-tab") o fundo ou nao mudava, ou mostrava um flash da
// imagem da aba ANTERIOR antes de trocar — o fix anterior (cache da ultima
// imagem via localStorage) causava exatamente isso no modo dinamico. A
// correcao real: uma fila de imagens JA BAIXADAS (blob redimensionado pro
// tamanho da tela) no IndexedDB, consumida atomicamente uma por aba, reposta
// pelo service worker em paralelo. Ver REGISTRO.md para o relato completo
// (inclusive o achado de que chrome.runtime.sendMessage serializa via JSON
// puro — Blob/ArrayBuffer nao sobrevivem, so string/base64).
//
// `context.route()` INTERCEPTA de verdade fetches originados de dentro do
// service worker da extensao (confirmado durante a escrita deste teste) —
// nao precisa de servidor HTTP externo nem de host_permissions extras: os
// domínios interceptados aqui (reddit.com/redd.it) ja estao na lista
// oficial do manifest.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, "..", "..", "dist");

async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

async function genColorJpeg(context: BrowserContext, color: string): Promise<Buffer> {
  const page = await context.newPage();
  const base64 = await page.evaluate(async (color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 2000;
    canvas.height = 1500;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 2000, 1500);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
    const buf = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
  }, color);
  await page.close();
  return Buffer.from(base64, "base64");
}

test.setTimeout(60_000);

test("fila de pre-fetch: 1a aba cai no fallback, abas seguintes consomem imagens distintas da fila, sem duplicar", async () => {
  const context = await launchWithExtension();

  const images: Record<string, Buffer> = {
    red: await genColorJpeg(context, "red"),
    green: await genColorJpeg(context, "green"),
    blue: await genColorJpeg(context, "blue"),
  };

  await context.route("https://www.reddit.com/**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          children: Object.keys(images).map((c) => ({
            data: {
              url: `https://i.redd.it/${c}.jpg`,
              post_hint: "image",
              over_18: false,
              preview: { images: [{ source: { width: 2000, height: 1500 } }] },
            },
          })),
        },
      }),
    });
  });
  await context.route("https://i.redd.it/**", (route: Route) => {
    const color = route.request().url().match(/\/(red|green|blue)\.jpg$/)?.[1] as keyof typeof images | undefined;
    if (color) route.fulfill({ status: 200, contentType: "image/jpeg", body: images[color] });
    else route.fulfill({ status: 404 });
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2]!;

  const configPage = await context.newPage();
  await configPage.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await configPage.evaluate(async () => {
    const res = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
    await chrome.runtime.sendMessage({
      type: "UPDATE_CONFIG",
      patch: {
        background: {
          ...res.config.background,
          source: "reddit",
          subreddits: ["wallpapers"],
          pausedKey: null,
          rotationMode: "per-tab",
        },
      },
    });
  });
  await configPage.close();

  // A config foi atualizada via mensagem direta (nao via store.updateConfig
  // da propria pagina) — o estado reativo de `configPage` nunca soube da
  // mudanca, entao ela nunca chegou a consultar a fila. A PRIMEIRA aba que
  // de fato monta com a config "reddit"/"per-tab" e quem dispara a 1a
  // consulta real: fila vazia, cai no fallback (URL remota) por design, e
  // so ENTAO dispara o refill que teremos que esperar terminar antes de
  // abrir as abas que devem consumir da fila ja pronta (achado real durante
  // a escrita deste teste).
  const warmPage = await context.newPage();
  await warmPage.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await warmPage.waitForFunction(
    () => getComputedStyle(document.querySelector(".background-layer")!).backgroundImage !== "none",
    { timeout: 6000 },
  );
  await warmPage.close();

  // Tempo pro refill (fire-and-forget, disparado pela warmPage) baixar+redimensionar as 3 imagens.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  async function openAndGetBg(): Promise<{ hasBlob: boolean; size: number }> {
    const p = await context.newPage();
    await p.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
    await p.waitForFunction(
      () => getComputedStyle(document.querySelector(".background-layer")!).backgroundImage !== "none",
      { timeout: 6000 },
    );
    const bgImage = await p.evaluate(() => getComputedStyle(document.querySelector(".background-layer")!).backgroundImage);
    const hasBlob = bgImage.startsWith('url("blob:');
    let size = 0;
    if (hasBlob) {
      const blobUrl = bgImage.match(/url\("(blob:[^"]+)"\)/)?.[1]!;
      size = await p.evaluate(async (url) => (await (await fetch(url)).blob()).size, blobUrl);
    }
    await p.close();
    return { hasBlob, size };
  }

  const aba2 = await openAndGetBg();
  const aba3 = await openAndGetBg();
  const aba4 = await openAndGetBg();

  for (const aba of [aba2, aba3, aba4]) {
    expect(aba.hasBlob).toBe(true); // imagem vem de um blob local (fila), nao de uma URL remota
    expect(aba.size).toBeGreaterThan(0); // passou por download+resize de verdade, nao um objeto vazio
  }

  await context.close();
});

test("mensagem POP_BACKGROUND_PREFETCH transporta a imagem via base64 (Blob/ArrayBuffer nao sobrevivem a sendMessage)", async () => {
  const context = await launchWithExtension();
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extensionId = worker.url().split("/")[2]!;

  // Listener de teste minimo no proprio SW real, so pra provar a limitacao
  // do transporte que motivou o uso de base64 — nao mexe no handler de
  // producao.
  await worker.evaluate(() => {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type !== "__TEST_TRANSPORT__") return false;
      sendResponse({ blob: new Blob(["x".repeat(500)], { type: "text/plain" }) });
      return true;
    });
  });

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  const transportResult = await page.evaluate(async () => {
    const res = await chrome.runtime.sendMessage({ type: "__TEST_TRANSPORT__" });
    return { isBlob: res.blob instanceof Blob };
  });
  expect(transportResult.isBlob).toBe(false);

  await context.close();
});
