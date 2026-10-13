import { describe, it, expect, vi } from "vitest";
import { MockInvoicingProvider } from "./mock";
import {
  externalStatusSchema,
  invoiceInputSchema,
  InvoicingError,
} from "./types";
import {
  invoiceFixture,
  MemoryMockInvoiceStore,
  canTransitionInvoice,
} from "./test-fixtures";
import { signMockWebhook } from "./webhook";
const secret = "synthetic-invoicing-secret-for-tests-only-42";
const factory = () =>
  new MockInvoicingProvider(new MemoryMockInvoiceStore(), {
    webhookSecret: secret,
  });
describe("mock provider contract", () => {
  it.each(externalStatusSchema.options)(
    "creates and reads the %s scenario",
    async (status) => {
      const provider = new MockInvoicingProvider(new MemoryMockInvoiceStore(), {
        initialStatus: status,
        webhookSecret: secret,
      });
      const result = await provider.createInvoice(invoiceFixture());
      expect(result.status).toBe(status);
      expect(await provider.getStatus(result.externalId)).toBe(status);
    },
  );
  it("makes concurrent retries idempotent and rejects a changed snapshot", async () => {
    const provider = factory();
    const input = invoiceFixture();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => provider.createInvoice(input)),
    );
    expect(new Set(results.map((r) => r.externalId)).size).toBe(1);
    await expect(
      provider.createInvoice({ ...input, paymentTerms: "60 giorni" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await provider.getStatus(results[0].externalId)).toBe("issued");
  });
  it("shares state through the supplied store across provider instances", async () => {
    const store = new MemoryMockInvoiceStore();
    const first = new MockInvoicingProvider(store, { webhookSecret: secret });
    const result = await first.createInvoice(invoiceFixture());
    const second = new MockInvoicingProvider(store, { webhookSecret: secret });
    await store.transition(result.externalId, "sent");
    expect(await second.getStatus(result.externalId)).toBe("sent");
    expect(await first.getStatus(result.externalId)).toBe("sent");
    await store.transition(result.externalId, "paid");
    await expect(first.cancelInvoice(result.externalId)).rejects.toMatchObject({
      code: "invalid_transition",
    });
  });
  it("supports cancellation and rejection while terminal states cannot regress", async () => {
    const rejectedStore = new MemoryMockInvoiceStore();
    const cancelled = factory(),
      rejected = new MockInvoicingProvider(rejectedStore, {
        webhookSecret: secret,
      });
    const a = await cancelled.createInvoice(invoiceFixture());
    const b = await rejected.createInvoice(invoiceFixture());
    await cancelled.cancelInvoice(a.externalId);
    expect(await cancelled.getStatus(a.externalId)).toBe("cancelled");
    await cancelled.cancelInvoice(a.externalId);
    await rejectedStore.transition(b.externalId, "rejected");
    expect(await rejected.getStatus(b.externalId)).toBe("rejected");
    for (const from of ["paid", "cancelled", "rejected"] as const)
      for (const to of externalStatusSchema.options)
        expect(canTransitionInvoice(from, to)).toBe(from === to);
  });
  it("rejects unknown references and invalid snapshots without creating an invoice", async () => {
    const provider = factory();
    await expect(provider.getStatus("unknown")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(provider.cancelInvoice("unknown")).rejects.toMatchObject({
      code: "not_found",
    });
    const input = invoiceFixture();
    await expect(
      provider.createInvoice({ ...input, grossCents: 2441 }),
    ).rejects.toBeInstanceOf(InvoicingError);
    expect(
      invoiceInputSchema.safeParse({ ...input, dueDate: "2032-01-01" }).success,
    ).toBe(false);
    expect(
      invoiceInputSchema.safeParse({ ...input, internal_notes: "private" })
        .success,
    ).toBe(false);
    expect(
      invoiceInputSchema.safeParse({ ...input, netCents: 2000.1 }).success,
    ).toBe(false);
  });
  it("simulates a bounded provider delay", async () => {
    vi.useFakeTimers();
    try {
      const provider = new MockInvoicingProvider(new MemoryMockInvoiceStore(), {
        webhookSecret: secret,
        delayMs: 250,
      });
      const pending = provider.getStatus("unknown").catch((e) => e);
      await vi.advanceTimersByTimeAsync(249);
      expect(vi.getTimerCount()).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toMatchObject({ code: "not_found" });
    } finally {
      vi.useRealTimers();
    }
    expect(
      () =>
        new MockInvoicingProvider(new MemoryMockInvoiceStore(), {
          webhookSecret: secret,
          delayMs: 10001,
        }),
    ).toThrow();
  });
});
describe("authenticated mock webhooks", () => {
  const timestamp = "1800000000";
  const body = JSON.stringify({
    eventId: "00000000-0000-4000-8000-000000000805",
    externalId: "mock_test",
    status: "sent",
  });
  const provider = () =>
    new MockInvoicingProvider(new MemoryMockInvoiceStore(), {
      webhookSecret: secret,
      now: () => 1800000000000,
    });
  async function request(data = body, time = timestamp, signed = data) {
    return new Request("https://app.test/api/webhooks/invoicing", {
      method: "POST",
      headers: {
        "x-invoicing-timestamp": time,
        "x-invoicing-signature": await signMockWebhook(signed, time, secret),
      },
      body: data,
    });
  }
  it.each(externalStatusSchema.options)(
    "verifies the signed %s event",
    async (status) => {
      const data = JSON.stringify({ ...JSON.parse(body), status });
      expect(await provider().parseWebhook(await request(data))).toMatchObject({
        status,
        externalId: "mock_test",
      });
    },
  );
  it("rejects missing authentication, tampering and timestamps outside five minutes", async () => {
    await expect(
      provider().parseWebhook(
        new Request("https://app.test", { method: "POST", body }),
      ),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      provider().parseWebhook(
        await request(body.replace("sent", "paid"), timestamp, body),
      ),
    ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      provider().parseWebhook(await request(body, "1799999699")),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
  it("rejects oversized, malformed or unexpected payloads", async () => {
    for (const data of [
      "x".repeat(16385),
      "{",
      JSON.stringify({ ...JSON.parse(body), status: "unknown" }),
      JSON.stringify({ ...JSON.parse(body), internal_notes: "private" }),
    ])
      await expect(
        provider().parseWebhook(await request(data)),
      ).rejects.toMatchObject({ code: "invalid_input" });
  });
});
