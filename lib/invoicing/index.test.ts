import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({})),
}));
import { createInvoicingProvider, invoicingProviderName } from "./index";
import { MockInvoicingProvider } from "./mock";
import { FattureInCloudProvider } from "./fic/provider";
import { ficFixtureCompanies } from "./test-fixtures-fic";
afterEach(() => vi.unstubAllEnvs());
describe("provider activation", () => {
  it("keeps the mock default and blocks FIC even for an existing reference unless explicitly enabled", async () => {
    vi.stubEnv("INVOICING_PROVIDER", "mock");
    vi.stubEnv("FIC_ACCESS_TOKEN", "synthetic-token");
    vi.stubEnv("FIC_COMPANIES_JSON", JSON.stringify(ficFixtureCompanies()));
    expect(invoicingProviderName()).toBe("mock");
    expect(await createInvoicingProvider()).toBeInstanceOf(
      MockInvoicingProvider,
    );
    await expect(createInvoicingProvider("fic")).rejects.toMatchObject({
      code: "unavailable",
    });
  });
  it("requires explicit FIC selection and complete server configuration", async () => {
    vi.stubEnv("INVOICING_PROVIDER", "fic");
    vi.stubEnv("FIC_ACCESS_TOKEN", "");
    await expect(createInvoicingProvider()).rejects.toMatchObject({
      code: "unavailable",
    });
    vi.stubEnv("FIC_ACCESS_TOKEN", "synthetic-token");
    vi.stubEnv("FIC_COMPANIES_JSON", JSON.stringify(ficFixtureCompanies()));
    vi.stubEnv("APP_URL", "https://mdc.example.test");
    expect(await createInvoicingProvider()).toBeInstanceOf(
      FattureInCloudProvider,
    );
    vi.stubEnv("INVOICING_PROVIDER", "unknown");
    expect(() => invoicingProviderName()).toThrow();
  });
});
