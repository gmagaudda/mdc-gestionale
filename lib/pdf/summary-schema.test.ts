import { expect, test } from "vitest";
import { brandSummarySchema } from "./summary-schema";
const report = {
  count: 0,
  order_count: 0,
  net_cents: "9007199254740993",
  vat_cents: "0",
  gross_cents: "9007199254740993",
  rows: [],
};
test("summary accepts exact SQL cents and rejects unsafe payloads", () => {
  expect(brandSummarySchema.parse(report).net_cents).toBe("9007199254740993");
  expect(
    brandSummarySchema.safeParse({ ...report, net_cents: 9007199254740993 })
      .success,
  ).toBe(false);
  expect(
    brandSummarySchema.safeParse({ ...report, net_cents: "12.5" }).success,
  ).toBe(false);
  expect(
    brandSummarySchema.safeParse({ ...report, internal_notes: "private" })
      .success,
  ).toBe(false);
  expect(
    brandSummarySchema.safeParse({
      ...report,
      rows: [
        {
          season_code: "FW26",
          customer: "Cliente riservato",
          city: "",
          order_count: 1,
          net_cents: "1",
          vat_cents: "0",
          gross_cents: "1",
          customer_id: "private",
        },
      ],
    }).success,
  ).toBe(false);
});
