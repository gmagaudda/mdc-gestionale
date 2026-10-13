import { expect, it } from "vitest";
import { securityHeaders } from "./headers";
it("limits network origins and excludes eval in production", () => {
  const h = Object.fromEntries(
    securityHeaders({
      supabaseUrl: "https://example.supabase.co",
      appUrl: "https://mdc.example",
      development: false,
    }).map(({ key, value }) => [key, value]),
  );
  expect(h["Content-Security-Policy"]).toContain(
    "connect-src 'self' https://example.supabase.co wss://example.supabase.co",
  );
  expect(h["Content-Security-Policy"]).not.toContain("unsafe-eval");
  expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  expect(h["Strict-Transport-Security"]).toBeTruthy();
});
it("permits local dev sockets and does not upgrade local HTTP", () => {
  const h = Object.fromEntries(
    securityHeaders({
      supabaseUrl: "http://127.0.0.1:54321",
      appUrl: "http://localhost:3100",
      development: true,
    }).map(({ key, value }) => [key, value]),
  );
  expect(h["Content-Security-Policy"]).toContain("unsafe-eval");
  expect(h["Content-Security-Policy"]).not.toContain("upgrade-insecure");
  expect(h).not.toHaveProperty("Strict-Transport-Security");
});
