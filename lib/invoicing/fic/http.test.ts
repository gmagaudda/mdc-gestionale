import { describe, it, expect, vi } from "vitest";
import { FicHttpClient, FIC_ORIGIN } from "./http";
import { exchangeFicToken } from "./oauth";
import { readFicCompanies } from "./config";
describe("FIC HTTP transport and OAuth", () => {
  it("retries reads with bounded backoff and respects short Retry-After", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 429, headers: { "Retry-After": "1" } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ data: { id: 1 } }));
    const pause = vi.fn(async () => {});
    const http = new FicHttpClient("synthetic-token", transport, pause);
    expect(await http.request("/user/info")).toEqual({ data: { id: 1 } });
    expect(pause.mock.calls).toEqual([[1000], [500]]);
    expect(
      transport.mock.calls.every(
        ([url, options]) =>
          String(url).startsWith(FIC_ORIGIN) &&
          options?.redirect === "error" &&
          options.cache === "no-store",
      ),
    ).toBe(true);
  });
  it("bounds retries, leaves long Retry-After to the caller and does not retry writes", async () => {
    for (const method of ["POST", "DELETE"] as const) {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 }));
      const http = new FicHttpClient(
        "synthetic-token",
        transport,
        async () => {},
      );
      await expect(
        http.request("/c/1/issued_documents", method, {}),
      ).rejects.toMatchObject({ code: "unavailable", retryable: true });
      expect(transport).toHaveBeenCalledTimes(1);
    }
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 500 }));
    await expect(
      new FicHttpClient("synthetic-token", transport, async () => {}).request(
        "/user/info",
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(transport).toHaveBeenCalledTimes(3);
    const slow = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
      );
    await expect(
      new FicHttpClient("synthetic-token", slow, async () => {}).request(
        "/user/info",
      ),
    ).rejects.toMatchObject({ retryable: true });
    expect(slow).toHaveBeenCalledTimes(1);
  });
  it("returns bounded stable errors for invalid JSON and oversized bodies", async () => {
    for (const response of [
      new Response("{broken"),
      new Response("x".repeat(4 * 1024 * 1024 + 1)),
    ])
      await expect(
        new FicHttpClient("synthetic-token", async () => response).request(
          "/user/info",
        ),
      ).rejects.toMatchObject({ message: "unavailable" });
  });
  it("requires explicit per-brand issuer/VAT configuration", () => {
    expect(() => readFicCompanies(undefined)).toThrow();
    expect(() => readFicCompanies("{}")).toThrow();
    expect(() => readFicCompanies('{"default":{"companyId":12345}}')).toThrow();
  });
  it("exchanges OAuth code/PKCE and returns both rotated tokens without logging them", async () => {
    const response = {
      access_token: "synthetic-access",
      refresh_token: "synthetic-refresh-new",
      token_type: "bearer",
      expires_in: 86400,
    };
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(response));
    expect(
      await exchangeFicToken(
        {
          grant_type: "authorization_code",
          client_id: "synthetic-client",
          client_secret: "synthetic-secret",
          code: "synthetic-code",
          redirect_uri: "https://mdc.example.test/callback",
          code_verifier: "x".repeat(43),
        },
        transport,
      ),
    ).toEqual(response);
    expect(
      await exchangeFicToken(
        {
          grant_type: "refresh_token",
          client_id: "synthetic-client",
          client_secret: "synthetic-secret",
          refresh_token: "synthetic-refresh-old",
        },
        transport,
      ),
    ).toEqual(response);
    expect(transport.mock.calls.map(([url]) => url)).toEqual([
      `${FIC_ORIGIN}/oauth/token`,
      `${FIC_ORIGIN}/oauth/token`,
    ]);
  });
  it("does not retry a token refresh or expose provider diagnostics", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { message: "secret-diagnostic" } },
          { status: 401 },
        ),
      );
    await expect(
      exchangeFicToken(
        {
          grant_type: "refresh_token",
          client_id: "synthetic-client",
          client_secret: "synthetic-secret",
          refresh_token: "synthetic-refresh-old",
        },
        transport,
      ),
    ).rejects.toMatchObject({ message: "unauthorized" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
