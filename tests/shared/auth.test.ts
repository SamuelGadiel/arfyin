import { describe, expect, it } from "vitest";
import { parseIdTokenFromRedirectUrl } from "@/shared/auth";

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
