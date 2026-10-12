import { it, expect } from "vitest";
import { portalDashboardSchema } from "./schema";
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
