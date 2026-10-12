// Shared synthetic contract input. No customer fixture contains real data.
import type { InvoiceInput } from "./types";
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
