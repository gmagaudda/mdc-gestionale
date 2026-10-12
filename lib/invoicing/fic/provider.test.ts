import { describe, it, expect } from "vitest";
import { FattureInCloudProvider } from "./provider";
import { FicHttpClient } from "./http";
import { invoiceFixture } from "../test-fixtures";
import {
  MemoryFicInvoiceStore,
  FicHttpRecording,
  ficFixtureCompanies,
  ficFixtureWebhook,
} from "../test-fixtures-fic";
import { documentStatus, decimalCents } from "./schemas";
function fixture() {
  const store = new MemoryFicInvoiceStore(),
    recording = new FicHttpRecording();
  const factory = () =>
    new FattureInCloudProvider(
      new FicHttpClient("synthetic-token", recording.fetch, async () => {}),
      store,
      ficFixtureCompanies(),
      ficFixtureWebhook,
    );
  return { store, recording, factory, provider: factory() };
}
describe("Fatture in Cloud HTTP recordings", () => {
  it("maps party, effective discounts, quantities, due date, explicit VAT and no SdI submission", async () => {
    const { provider, recording } = fixture();
    await provider.createInvoice(invoiceFixture());
    const creation = recording.calls.find(
      (c) =>
        c.method === "POST" &&
        new URL(c.url).pathname.endsWith("/issued_documents"),
    )!;
    expect(creation.headers.get("authorization")).toBe(
      "Bearer synthetic-token",
    );
    expect(creation.body).toMatchObject({
      data: {
        type: "invoice",
        e_invoice: false,
        numeration: "/MDC",
        entity: { country: "Italia", name: "Società di prova" },
        items_list: [
          { qty: 2, net_price: 10, discount: 0, vat: { id: 0 }, stock: false },
        ],
        payments_list: [
          { amount: 24.4, due_date: "2033-02-01", status: "not_paid" },
        ],
      },
      options: { fix_payments: false },
    });
    expect(JSON.stringify(creation.body)).not.toContain('"supplier"');
    expect(recording.calls.some((c) => c.url.includes("e_invoice/send"))).toBe(
      false,
    );
  });
  it("reconciles a timeout after upstream creation, including across provider instances", async () => {
    const { provider, factory, recording } = fixture();
    recording.failCreation = "network";
    await expect(
      provider.createInvoice(invoiceFixture()),
    ).rejects.toMatchObject({ code: "unavailable", retryable: true });
    const result = await factory().createInvoice(invoiceFixture());
    expect(result.externalId).toBe("fic_12345_500");
    expect(
      recording.calls.filter(
        (c) =>
          c.method === "POST" &&
          new URL(c.url).pathname.endsWith("/issued_documents"),
      ),
    ).toHaveLength(1);
  });
  it("never reissues when an uncertain request has no visible match", async () => {
    const { provider, factory, recording } = fixture();
    recording.failCreation = "network-before";
    await expect(
      provider.createInvoice(invoiceFixture()),
    ).rejects.toMatchObject({ code: "unavailable" });
    await expect(
      factory().createInvoice(invoiceFixture()),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      recording.calls.filter(
        (c) =>
          c.method === "POST" &&
          new URL(c.url).pathname.endsWith("/issued_documents"),
      ),
    ).toHaveLength(1);
  });
  it.each([401, 403, 422, 429])(
    "allows explicit retry after definite HTTP %i rejection without exposing its body",
    async (status) => {
      const { provider, factory, recording, store } = fixture();
      recording.failCreation = status;
      await expect(
        provider.createInvoice(invoiceFixture()),
      ).rejects.toMatchObject({
        message:
          status === 401 || status === 403
            ? "unauthorized"
            : status === 422
              ? "invalid_input"
              : "unavailable",
      });
      expect(store.records.get(invoiceFixture().invoiceId)?.state).toBe(
        "prepared",
      );
      expect((await factory().createInvoice(invoiceFixture())).status).toBe(
        "issued",
      );
      expect(recording.documents.size).toBe(1);
    },
  );
  it("keeps 5xx uncertain instead of retrying a write", async () => {
    const { provider, recording, store } = fixture();
    recording.failCreation = 500;
    await expect(
      provider.createInvoice(invoiceFixture()),
    ).rejects.toMatchObject({ code: "unavailable", retryable: true });
    expect(store.records.get(invoiceFixture().invoiceId)?.state).toBe(
      "uncertain",
    );
    expect(
      recording.calls.filter(
        (c) =>
          c.method === "POST" &&
          new URL(c.url).pathname.endsWith("/issued_documents"),
      ),
    ).toHaveLength(1);
  });
  it("rejects monetary differences before issuing and mismatched supplier/company mappings", async () => {
    const { provider, recording } = fixture();
    recording.totalsOffset = 0.01;
    await expect(
      provider.createInvoice(invoiceFixture()),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(recording.documents.size).toBe(0);
    const f = fixture();
    const input = invoiceFixture();
    input.supplier.vat_number = "99999999999";
    await expect(f.provider.createInvoice(input)).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect(f.recording.calls).toHaveLength(0);
  });
  it("does not read an arbitrary external company's document", async () => {
    const { provider, recording } = fixture();
    await expect(provider.getStatus("fic_99999_500")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(provider.getStatus("fic_12345_600")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(recording.calls).toHaveLength(0);
  });
  it("guards cancellation of locked, electronic, sent, partially paid and paid documents", async () => {
    for (const change of [
      { locked: true },
      { e_invoice: true },
      { ei_status: "sent" as const },
      {
        payments_list: [
          { amount: 10, status: "paid" as const },
          { amount: 14.4, status: "not_paid" as const },
        ],
      },
    ]) {
      const { provider, recording } = fixture();
      const result = await provider.createInvoice(invoiceFixture());
      Object.assign(recording.documents.get(500)!, change);
      await expect(
        provider.cancelInvoice(result.externalId),
      ).rejects.toMatchObject({ code: "invalid_transition" });
      expect(recording.bin.size).toBe(0);
    }
  });
  it("rejects external edits to monetary totals before status updates or cancellation", async () => {
    const { provider, recording } = fixture();
    const result = await provider.createInvoice(invoiceFixture());
    recording.documents.get(500)!.amount_gross = 24.41;
    await expect(provider.getStatus(result.externalId)).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(
      provider.cancelInvoice(result.externalId),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(recording.bin.size).toBe(0);
  });
  it("does not guess a VAT ID or accept an unlisted recipient country", async () => {
    for (const change of ["vat", "country"]) {
      const store = new MemoryFicInvoiceStore(),
        recording = new FicHttpRecording(),
        companies = ficFixtureCompanies(),
        input = invoiceFixture();
      if (change === "vat") companies[input.brandId].vatIds = { "22": 99 };
      else input.customer.address.country = "DE";
      const provider = new FattureInCloudProvider(
        new FicHttpClient("synthetic-token", recording.fetch, async () => {}),
        store,
        companies,
        ficFixtureWebhook,
      );
      await expect(provider.createInvoice(input)).rejects.toMatchObject({
        code: "invalid_input",
      });
      expect(recording.documents.size).toBe(0);
    }
  });
  it("maps statuses without treating an operational transmission error as a rejection", async () => {
    const { provider, recording } = fixture();
    await provider.createInvoice(invoiceFixture());
    const doc = recording.documents.get(500)!;
    for (const ei of ["not_sent", "attempt", "pending", "error"] as const)
      expect(documentStatus({ ...doc, ei_status: ei })).toBe("issued");
    for (const ei of ["sent", "accepted", "not_delivered"] as const)
      expect(documentStatus({ ...doc, ei_status: ei })).toBe("sent");
    for (const ei of ["discarded", "rejected", "manual_rejected"] as const)
      expect(documentStatus({ ...doc, ei_status: ei })).toBe("rejected");
    expect(
      documentStatus({
        ...doc,
        payments_list: [{ amount: 24.4, status: "paid" }],
      }),
    ).toBe("paid");
    expect(decimalCents(24.4)).toBe(2440n);
    expect(() => decimalCents(24.401)).toThrow();
  });
});
