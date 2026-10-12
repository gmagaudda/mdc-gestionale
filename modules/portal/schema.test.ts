import { it, expect } from "vitest";
import {
  portalDashboardSchema,
  portalOrdersSchema,
  portalOrderFiltersSchema,
} from "./schema";
it("rejects accidental internal fields in a portal report", () => {
  const report = {
    sold_cents: "1000",
    order_count: 1,
    budget_count: 0,
    budgets: [],
  };
  expect(portalDashboardSchema.safeParse(report).success).toBe(true);
  expect(
    portalDashboardSchema.safeParse({ ...report, revenue_cents: "1000" })
      .success,
  ).toBe(false);
  expect(
    portalDashboardSchema.safeParse({ ...report, internal_notes: "secret" })
      .success,
  ).toBe(false);
});
it("limits order report shape and rejects unknown statuses", () => {
  expect(
    portalOrderFiltersSchema.safeParse({ status: "approved" }).success,
  ).toBe(false);
  expect(
    portalOrdersSchema.safeParse({
      count: 0,
      rows: [],
      internal_notes: "secret",
    }).success,
  ).toBe(false);
  expect(portalOrdersSchema.safeParse({ count: 0, rows: [] }).success).toBe(
    true,
  );
});
