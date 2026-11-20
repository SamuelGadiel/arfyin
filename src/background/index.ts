import { buildPong, isPingMessage } from "@shared/messaging";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isPingMessage(message)) {
    sendResponse(buildPong());
    return true;
  }
  return false;
});
