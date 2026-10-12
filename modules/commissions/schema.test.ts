import { it, expect } from "vitest";
import { commissionsFiltersSchema, commissionsReportSchema } from "./schema";
it("validates exact report cents and inclusive date filters", () => {
  expect(
    commissionsFiltersSchema.safeParse({ from: "2032-02-01", to: "2032-01-31" })
      .success,
  ).toBe(false);
  const report = {
    net_cents: "9007199254740993",
    commission_cents: "123",
    order_count: 0,
    brand_count: 0,
    brands: [],
    orders: [],
  };
  expect(commissionsReportSchema.parse(report).net_cents).toBe(
    "9007199254740993",
  );
  expect(
    commissionsReportSchema.safeParse({ ...report, commission_cents: "1.5" })
      .success,
  ).toBe(false);
});
