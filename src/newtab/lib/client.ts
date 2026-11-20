import type { ArfyinMessage, ArfyinResponse } from "@/shared/messaging";

export async function send<T extends ArfyinResponse["type"]>(
  message: ArfyinMessage,
): Promise<Extract<ArfyinResponse, { type: T }>> {
  const response = (await chrome.runtime.sendMessage(message)) as ArfyinResponse;
  return response as Extract<ArfyinResponse, { type: T }>;
}
