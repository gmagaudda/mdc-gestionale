// Shared synthetic contract input. No customer fixture contains real data.
import {
  InvoicingError,
  type InvoiceInput,
  type ExternalStatus,
} from "./types";
import type { MockInvoiceStore, MockInvoiceRecord } from "./mock";
export function invoiceFixture(): InvoiceInput {
  const party = {
    legal_name: "Società di prova",
    vat_number: "12345678901",
    tax_code: "",
    sdi_code: "0000000",
    pec: "",
    address: {
      street: "Via di prova 1",
      postal_code: "00100",
      city: "Roma",
      province: "RM",
      country: "IT",
    },
  };
  return {
    invoiceId: "00000000-0000-4000-8000-000000000801",
    idempotencyKey: "00000000-0000-4000-8000-000000000802",
    orderId: "00000000-0000-4000-8000-000000000803",
    brandId: "00000000-0000-4000-8000-000000000804",
    number: "2033/00001",
    issueDate: "2033-01-01",
    dueDate: "2033-02-01",
    currency: "EUR",
    paymentTerms: "30 giorni",
    orderDiscountPct: 0,
    supplier: structuredClone(party),
    customer: structuredClone(party),
    lines: [
      {
        name: "Camicia",
        sku: "TEST-M",
        variant: "Nero / M",
        quantity: 2,
        unit_price_cents: 1000,
        discount_pct: 0,
        vat_rate: 22,
        net_cents: 2000,
        vat_cents: 440,
      },
    ],
    netCents: 2000,
    vatCents: 440,
    grossCents: 2440,
  };
}

export function canTransitionInvoice(from: ExternalStatus, to: ExternalStatus) {
  if (from === to) return true;
  const transitions: Record<ExternalStatus, ExternalStatus[]> = {
    draft: ["issued", "sent", "paid", "cancelled", "rejected"],
    issued: ["sent", "paid", "cancelled", "rejected"],
    sent: ["paid", "cancelled", "rejected"],
    paid: [],
    cancelled: [],
    rejected: [],
  };
  return transitions[from].includes(to);
}
export class MemoryMockInvoiceStore implements MockInvoiceStore {
  private readonly byKey = new Map<string, MockInvoiceRecord>();
  private readonly byId = new Map<string, MockInvoiceRecord>();
  async putIfAbsent(record: MockInvoiceRecord) {
    const existing = this.byKey.get(record.idempotencyKey);
    if (existing) {
      if (
        existing.fingerprint !== record.fingerprint ||
        existing.externalId !== record.externalId
      )
        throw new InvoicingError("conflict");
      return { ...existing };
    }
    if (this.byId.has(record.externalId)) throw new InvoicingError("conflict");
    this.byKey.set(record.idempotencyKey, { ...record });
    this.byId.set(record.externalId, this.byKey.get(record.idempotencyKey)!);
    return { ...record };
  }
  async get(id: string) {
    const record = this.byId.get(id);
    return record ? { ...record } : null;
  }
  async transition(id: string, status: ExternalStatus) {
    const record = this.byId.get(id);
    if (!record) throw new InvoicingError("not_found");
    if (!canTransitionInvoice(record.status, status))
      throw new InvoicingError("invalid_transition");
    record.status = status;
    return { ...record };
  }
}
