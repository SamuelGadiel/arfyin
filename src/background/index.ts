import { openArfyinDb } from "@/shared/storage";
import { isArfyinMessage } from "@/shared/messaging";
import { computeSpecKey, blobToBase64, type BgSpec } from "@/shared/backgroundFetch";
import { routeMessage, bootstrapSync } from "./router";
import { registerLiveTabsBroadcast } from "./liveTabsBroadcast";
import { popAndRefill } from "./backgroundPrefetch";

registerLiveTabsBroadcast();

// Service worker MV3 e efemero — abrir o banco a cada wake-up e nao guardar
// nada de critico so em memoria (ver ADR-003 em docs/architecture/decisions.md).
const dbPromise = openArfyinDb();

const SYNC_ALARM_NAME = "arfyin-periodic-sync";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SYNC_ALARM_NAME) return;
  // bootstrapSync (pull-and-merge + push), nao so kickSync (push) — assim
  // mudancas feitas em outro dispositivo convergem para ca periodicamente,
  // nao so no momento do login.
  dbPromise.then(bootstrapSync).catch((err) => {
    console.error("[arfyin] bootstrapSync periodico falhou:", err instanceof Error ? err.message : err);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isArfyinMessage(message)) return false;

  // Caso especial: so toca chrome.tabs, nenhuma leitura/escrita em `db` — nao
  // entra no switch de routeMessage, que e documentado/testado como puro,
  // sem chrome.* (ver ADR-015 em docs/architecture/decisions.md).
  if (message.type === "MOVE_LIVE_TAB") {
    chrome.tabs
      .move(message.tabIds, { windowId: message.windowId, index: message.index })
      .then(() => sendResponse({ type: "LIVE_TAB_MOVED" }))
      .catch((err) =>
        sendResponse({
          type: "LIVE_TAB_MOVE_FAILED",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    return true;
  }

  // Mesmo motivo do MOVE_LIVE_TAB acima: faz fetch de rede real (baixa e
  // redimensiona a proxima imagem), nao e puro/testavel com fake-indexeddb
  // sozinho — ver ADR-015.
  if (message.type === "POP_BACKGROUND_PREFETCH") {
    const spec: BgSpec = {
      source: message.source,
      subreddits: message.subreddits,
      unsplashTopics: message.unsplashTopics,
      localAssetIds: [],
      pausedKey: null,
      rotationMode: "per-tab",
      frequencyMinutes: 0,
      timedStartedAt: 0,
    };
    const specKey = computeSpecKey(spec);
    dbPromise
      .then((db) => popAndRefill(db, specKey, spec, message.targetWidth, message.targetHeight))
      .then(async (res) => {
        const imageBase64 = res.blob ? await blobToBase64(res.blob) : null;
        sendResponse({
          type: "BACKGROUND_PREFETCH",
          imageBase64,
          mimeType: res.blob?.type,
          sourceUrl: res.sourceUrl,
          attribution: res.attribution,
        });
      })
      .catch((err) => {
        console.error("[arfyin] POP_BACKGROUND_PREFETCH falhou:", err instanceof Error ? err.message : err);
        sendResponse({ type: "BACKGROUND_PREFETCH", imageBase64: null });
      });
    return true;
  }

  dbPromise
    .then((db) => routeMessage(db, message))
    .then(sendResponse);

  return true;
});
