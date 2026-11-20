import { describe, expect, it } from "vitest";
import { buildPong, isPingMessage } from "@/shared/messaging";

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
});
