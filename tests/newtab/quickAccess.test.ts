import { describe, expect, it } from "vitest";
import { resolveQuickAccessKey } from "@/newtab/lib/quickAccess";

describe("resolveQuickAccessKey", () => {
  it("digito 1-9 sem modificador: abre com foco", () => {
    expect(resolveQuickAccessKey("Digit5", false)).toEqual({
      type: "open-one",
      slot: 5,
      focus: true,
    });
  });

  it("digito 1-9 com modificador: abre sem foco", () => {
    expect(resolveQuickAccessKey("Digit3", true)).toEqual({
      type: "open-one",
      slot: 3,
      focus: false,
    });
  });

  it("digito 0: abre todos", () => {
    expect(resolveQuickAccessKey("Digit0", false)).toEqual({ type: "open-all", focus: true });
    expect(resolveQuickAccessKey("Digit0", true)).toEqual({ type: "open-all", focus: false });
  });

  it("teclas nao numericas sao ignoradas", () => {
    expect(resolveQuickAccessKey("Space", false)).toEqual({ type: "none" });
    expect(resolveQuickAccessKey("KeyA", false)).toEqual({ type: "none" });
  });
});
