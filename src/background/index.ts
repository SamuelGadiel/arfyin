import { openArfyinDb } from "@/shared/storage";
import { isArfyinMessage } from "@/shared/messaging";
import { routeMessage, bootstrapSync } from "./router";
import { registerLiveTabsBroadcast } from "./liveTabsBroadcast";

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

  dbPromise
    .then((db) => routeMessage(db, message))
    .then(sendResponse);

  return true;
});
