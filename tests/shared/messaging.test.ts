import { describe, expect, it } from "vitest";
import { buildPong, isArfyinMessage, isPingMessage } from "@/shared/messaging";

describe("messaging", () => {
  it("reconhece uma PingMessage valida", () => {
    expect(isPingMessage({ type: "PING" })).toBe(true);
  });

  it("rejeita mensagens que nao sao PING", () => {
    expect(isPingMessage({ type: "PONG" })).toBe(false);
    expect(isPingMessage(null)).toBe(false);
    expect(isPingMessage("PING")).toBe(false);
  });

  it("monta uma PongMessage com o timestamp injetado", () => {
    const pong = buildPong(() => 42);
    expect(pong).toEqual({ type: "PONG", ts: 42 });
  });

  it("isArfyinMessage reconhece MOVE_LIVE_TAB", () => {
    expect(
      isArfyinMessage({ type: "MOVE_LIVE_TAB", tabIds: [1, 2], windowId: 10, index: 0 }),
    ).toBe(true);
  });

  it("isArfyinMessage rejeita tipos desconhecidos", () => {
    expect(isArfyinMessage({ type: "NOT_A_REAL_MESSAGE" })).toBe(false);
    expect(isArfyinMessage(null)).toBe(false);
  });
});
