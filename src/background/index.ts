import { openArfyinDb } from "@/shared/storage";
import { isArfyinMessage } from "@/shared/messaging";
import { routeMessage } from "./router";

// Service worker MV3 e efemero — abrir o banco a cada wake-up e nao guardar
// nada de critico so em memoria (ver ADR-003 em docs/architecture/decisions.md).
const dbPromise = openArfyinDb();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isArfyinMessage(message)) return false;

  dbPromise
    .then((db) => routeMessage(db, message))
    .then(sendResponse);

  return true;
});
