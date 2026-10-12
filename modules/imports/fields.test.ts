import { expect, it } from "vitest";
import { mappingProfileSchema, suggestMapping } from "./fields";
import { normalizeMappedSheet } from "./validation";
import { validTaxCode, normalizePercentage } from "./normalize";
const profile = (
  entity: "customers" | "orders" | "budgets",
  headers: string[],
) =>
  mappingProfileSchema.parse({
    name: "Synthetic",
    entity,
    sheet_name: "Synthetic",
    header_row: 1,
    mapping: suggestMapping(headers, entity),
    options: {},
  });
it("suggests the columns of the three synthetic entities", () => {
  expect(
    suggestMapping(
      ["Codice negozio", "Ragione sociale", "Città", "Paese", "Email"],
      "customers",
    ),
  ).toMatchObject({
    external_code: 0,
    legal_name: 1,
    city: 2,
    country: 3,
    email: 4,
  });
  expect(
    suggestMapping(
      [
        "Riferimento ordine",
        "Negozio",
        "Brand",
        "Stagione",
        "Data ordine",
        "SKU",
        "Quantità",
        "Prezzo unitario",
        "Sconto",
      ],
      "orders",
    ),
  ).toMatchObject({
    external_ref: 0,
    customer: 1,
    brand: 2,
    season: 3,
    order_date: 4,
    sku: 5,
    quantity: 6,
    unit_price_cents: 7,
    line_discount_pct: 8,
  });
  expect(
    suggestMapping(
      [
        "Brand",
        "Stagione",
        "Negozio",
        "Importo budget",
        "Inizio periodo",
        "Fine periodo",
      ],
      "budgets",
    ),
  ).toMatchObject({
    brand: 0,
    season: 1,
    customer: 2,
    amount_cents: 3,
    period_start: 4,
    period_end: 5,
  });
});
it("rejects invented canonical fields in persisted profiles", () => {
  const p = profile("customers", ["Ragione sociale"]);
  expect(
    mappingProfileSchema.safeParse({
      ...p,
      mapping: { ...p.mapping, admin: 0 },
    }).success,
  ).toBe(false);
});
it("leaves ambiguous headers for manual selection", () => {
  expect(
    suggestMapping(["Ragione sociale", "Nome negozio"], "customers").legal_name,
  ).toBeNull();
});
it("reports the deliberate email/date/quantity/price errors with physical row numbers", () => {
  const customerHeaders = [
    "Codice negozio",
    "Ragione sociale",
    "Città",
    "Paese",
    "Email",
  ];
  const customers = normalizeMappedSheet(
    {
      name: "Synthetic",
      rows: [
        { number: 1, values: customerHeaders },
        {
          number: 4,
          values: ["N002", "Negozio sintetico", "Roma", "IT", "email-invalida"],
        },
      ],
    },
    profile("customers", customerHeaders),
  );
  expect(customers[0]).toMatchObject({
    row_number: 4,
    status: "error",
    messages: [{ field: "email", code: "invalidValue", severity: "error" }],
  });
  const headers = [
    "Riferimento ordine",
    "Negozio",
    "Brand",
    "Stagione",
    "Data ordine",
    "SKU",
    "Quantità",
    "Prezzo unitario",
  ];
  const orders = normalizeMappedSheet(
    {
      name: "Synthetic",
      rows: [
        { number: 1, values: headers },
        {
          number: 8,
          values: [
            "O002",
            "N002",
            "Brand sintetico",
            "SS27",
            "31/02/2027",
            "SYN",
            -1,
            "testo",
          ],
        },
      ],
    },
    profile("orders", headers),
  );
  expect(orders[0].messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ field: "order_date", code: "invalidValue" }),
      expect.objectContaining({ field: "quantity", code: "invalidValue" }),
      expect.objectContaining({
        field: "unit_price_cents",
        code: "invalidValue",
      }),
    ]),
  );
});
it("detects duplicate store identities before staging", () => {
  const headers = ["Codice negozio", "Ragione sociale"],
    p = profile("customers", headers);
  const rows = normalizeMappedSheet(
    {
      name: "Synthetic",
      rows: [
        { number: 1, values: headers },
        { number: 2, values: ["N001", "Uno"] },
        { number: 3, values: ["N001", "Due"] },
      ],
    },
    p,
  );
  expect(
    rows.every(
      (r) =>
        r.status === "error" && r.messages.some((m) => m.code === "duplicate"),
    ),
  ).toBe(true);
});
it("supports mapped defaults without inventing operational dates", () => {
  const headers = [
      "Negozio",
      "Brand",
      "Stagione",
      "SKU",
      "Quantità",
      "Prezzo unitario",
    ],
    p = profile("orders", headers);
  const sheet = {
    name: "Synthetic",
    rows: [
      { number: 1, values: headers },
      { number: 2, values: ["N001", "Brand", "SS27", "SKU", 2, "12,50"] },
    ],
  };
  expect(normalizeMappedSheet(sheet, p)[0].messages).toContainEqual({
    field: "order_date",
    code: "required",
    severity: "error",
  });
  p.options.defaults.order_date = "15/01/2027";
  expect(normalizeMappedSheet(sheet, p)[0]).toMatchObject({
    status: "valid",
    mapped: { order_date: "2027-01-15", unit_price_cents: 1250 },
  });
});
it("validates alphabetic and numeric tax code transcription, including omocodia", () => {
  expect(validTaxCode("AAAAAA00A01A001G")).toBe(true);
  expect(validTaxCode("aaaaaa00a01a001g")).toBe(true);
  expect(validTaxCode("AAAAAA00A0MA001Y")).toBe(true);
  expect(validTaxCode("AAAAAA00A01A001H")).toBe(false);
  expect(validTaxCode("01114601006")).toBe(true);
  expect(validTaxCode("01114601007")).toBe(false);
});
it("does not confuse percentage points with XLSX ratios", () => {
  expect(normalizePercentage(0.125, "it", "ratio")).toBe(12.5);
  expect(normalizePercentage("0,125", "it", "ratio")).toBe(12.5);
  expect(normalizePercentage("10%", "it", "ratio")).toBe(10);
  expect(normalizePercentage(10, "it", "percent")).toBe(10);
  expect(normalizePercentage(10, "it", "ratio")).toBeNull();
});

it("requires zero discounts for totals already supplied as net amounts", () => {
  const headers = [
      "Negozio",
      "Brand",
      "Stagione",
      "Data ordine",
      "Totale ordine",
      "Descrizione articolo",
      "IVA",
      "Sconto",
    ],
    p = profile("orders", headers);
  p.mapping.total_cents = 4;
  p.mapping.product_name = 5;
  p.mapping.vat_rate = 6;
  p.mapping.line_discount_pct = 7;
  p.options.granularity = "order_totals";
  const rows = normalizeMappedSheet(
    {
      name: "Synthetic",
      rows: [
        { number: 1, values: headers },
        {
          number: 2,
          values: [
            "N1",
            "Brand",
            "SS27",
            "01/01/2027",
            "100,00",
            "Riepilogo",
            22,
            10,
          ],
        },
      ],
    },
    p,
  );
  expect(rows[0].messages).toContainEqual({
    field: "line_discount_pct",
    code: "invalidValue",
    severity: "error",
  });
});
