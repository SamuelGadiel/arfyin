import { describe, expect, it } from "vitest";
import { parseIdTokenFromRedirectUrl, sha256Hex } from "@/shared/auth";

describe("parseIdTokenFromRedirectUrl", () => {
  it("extrai o id_token do fragmento da url de retorno", () => {
    const url = "https://abc123.chromiumapp.org/#id_token=eyJhbGciOi.foo.bar&state=xyz";
    expect(parseIdTokenFromRedirectUrl(url)).toBe("eyJhbGciOi.foo.bar");
  });

  it("retorna null quando nao ha fragmento", () => {
    expect(parseIdTokenFromRedirectUrl("https://abc123.chromiumapp.org/")).toBeNull();
  });

  it("retorna null quando o fragmento nao tem id_token", () => {
    expect(parseIdTokenFromRedirectUrl("https://abc123.chromiumapp.org/#error=access_denied")).toBeNull();
  });
});

describe("sha256Hex", () => {
  it("bate com vetores de teste conhecidos do SHA-256", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
