import { describe, it, expect } from "vitest";
import { MockInvoicingProvider, MemoryMockInvoiceStore } from "./mock";
import { FattureInCloudProvider } from "./fic/provider";
import { FicHttpClient } from "./fic/http";
import { invoiceFixture } from "./test-fixtures";
import {
  MemoryFicInvoiceStore,
  FicHttpRecording,
  ficFixtureCompanies,
  ficFixtureWebhook,
} from "./test-fixtures-fic";
import type { InvoicingProvider } from "./types";
for (const name of ["mock", "fic"] as const) {
  describe(`${name}: shared InvoicingProvider contract`, () => {
    function fixture() {
      if (name === "mock") {
        const store = new MemoryMockInvoiceStore();
        const factory = () =>
          new MockInvoicingProvider(store, {
            webhookSecret: "synthetic-secret-for-shared-contract-only-42",
          });
        return { provider: factory(), factory };
      }
      const store = new MemoryFicInvoiceStore(),
        recording = new FicHttpRecording();
      const factory = () =>
        new FattureInCloudProvider(
          new FicHttpClient("synthetic-token", recording.fetch, async () => {}),
          store,
          ficFixtureCompanies(),
          ficFixtureWebhook,
        );
      return { provider: factory(), factory };
    }
    it("creates, reads and repeats one immutable snapshot", async () => {
      const { provider, factory } = fixture(),
        input = invoiceFixture();
      const created = await provider.createInvoice(input);
      expect(created.status).toBe("issued");
      expect(await provider.getStatus(created.externalId)).toBe("issued");
      expect(await factory().createInvoice(input)).toEqual(created);
      await expect(
        provider.createInvoice({ ...input, paymentTerms: "60 giorni" }),
      ).rejects.toMatchObject({ code: "conflict" });
    });
    it("coalesces concurrent identical requests", async () => {
      const provider: InvoicingProvider = fixture().provider;
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          provider.createInvoice(invoiceFixture()),
        ),
      );
      expect(new Set(results.map((r) => r.externalId)).size).toBe(1);
    });
    it("cancels without losing the reference and cancellation is repeatable", async () => {
      const { provider, factory } = fixture();
      const result = await provider.createInvoice(invoiceFixture());
      await provider.cancelInvoice(result.externalId);
      expect(await factory().getStatus(result.externalId)).toBe("cancelled");
      await provider.cancelInvoice(result.externalId);
    });
    it("rejects unknown references", async () => {
      const provider: InvoicingProvider = fixture().provider;
      await expect(provider.getStatus("unknown")).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(provider.cancelInvoice("unknown")).rejects.toMatchObject({
        code: "not_found",
      });
    });
    it("validates fiscal input and totals before side effects", async () => {
      const provider: InvoicingProvider = fixture().provider;
      await expect(
        provider.createInvoice({ ...invoiceFixture(), grossCents: 2441 }),
      ).rejects.toMatchObject({ code: "invalid_input" });
      await expect(
        provider.createInvoice({ ...invoiceFixture(), dueDate: "2032-01-01" }),
      ).rejects.toMatchObject({ code: "invalid_input" });
    });
    it("rejects unauthenticated callbacks", async () => {
      const provider: InvoicingProvider = fixture().provider;
      await expect(
        provider.parseWebhook(
          new Request("https://mdc.example.test/api/webhooks/invoicing", {
            method: "POST",
            body: "{}",
          }),
        ),
      ).rejects.toMatchObject({ code: "unauthorized" });
    });
  });
}
