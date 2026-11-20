import { openArfyinDb } from "@/shared/storage";
import { isArfyinMessage } from "@/shared/messaging";
import { routeMessage, kickSync } from "./router";

// Service worker MV3 e efemero — abrir o banco a cada wake-up e nao guardar
// nada de critico so em memoria (ver ADR-003 em docs/architecture/decisions.md).
const dbPromise = openArfyinDb();

const SYNC_ALARM_NAME = "arfyin-periodic-sync";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SYNC_ALARM_NAME) return;
  dbPromise.then(kickSync);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isArfyinMessage(message)) return false;

  dbPromise
    .then((db) => routeMessage(db, message))
    .then(sendResponse);

  return true;
});
