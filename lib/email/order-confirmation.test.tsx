import { describe, it, expect } from "vitest";
import {
  orderConfirmationSchema,
  renderOrderConfirmation,
} from "./order-confirmation";
const sample = {
  number: "2032/1",
  brand: "Brand <script>bad()</script>",
  customer: "Cliente & soci",
  season: "SS27",
  order_date: "2032-01-01",
  delivery_date: null,
  payment_terms: "30 giorni",
  discount_pct: 0,
  net_cents: "3998",
  vat_cents: "880",
  gross_cents: "4878",
  lines: [
    {
      product: "Camicia",
      sku: "SKU",
      color: "Blu",
      size: "M",
      quantity: 2,
      unit_cents: "1999",
      discount_pct: 0,
      vat_rate: 22,
      net_cents: "3998",
    },
  ],
};
describe("commercial order confirmation", () => {
  it("escapes HTML and renders exact Italian amounts without private fields", async () => {
    const result = await renderOrderConfirmation(
      orderConfirmationSchema.parse(sample),
    );
    expect(result.html).not.toContain("<script>bad()");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.text).toContain("39,98");
    expect(result.text).toContain("8,80");
    expect(result.text).toContain("48,78");
    expect(result.text).toContain("30 giorni");
    expect(result.subject).toContain("2032/1");
    expect(
      orderConfirmationSchema.safeParse({ ...sample, internal_notes: "secret" })
        .success,
    ).toBe(false);
    expect(
      orderConfirmationSchema.safeParse({ ...sample, gross_cents: 48.78 })
        .success,
    ).toBe(false);
  });
});
