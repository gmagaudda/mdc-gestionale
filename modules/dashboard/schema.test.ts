import { it, expect } from "vitest";
import { chartCents, dashboardFiltersSchema } from "./schema";
it("validates dashboard dates and ids", () => {
  expect(
    dashboardFiltersSchema.safeParse({ from: "2032-02-01", to: "2032-01-01" })
      .success,
  ).toBe(false);
  expect(
    dashboardFiltersSchema.safeParse({ brand_id: "not-a-brand" }).success,
  ).toBe(false);
  expect(dashboardFiltersSchema.safeParse({}).success).toBe(true);
});
it("never approximates chart values beyond safe integers", () => {
  expect(chartCents("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
  expect(chartCents("9007199254740992")).toBeNull();
  expect(chartCents("123456")).toBe(123456);
});
