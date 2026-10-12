import { describe, it, expect } from "vitest";
import { budgetSchema, budgetsOverlap } from "./schema";
const budget = {
  brand_id: "00000000-0000-4000-8000-000000000001",
  season_id: "",
  customer_id: "",
  amount_cents: 12345,
  period_start: "2026-01-01",
  period_end: "2026-01-31",
  notes: "",
};
describe("budgets", () => {
  it("accepts integer cents and inclusive single days", () =>
    expect(
      budgetSchema.safeParse({ ...budget, period_end: budget.period_start })
        .success,
    ).toBe(true));
  it.each([
    { amount_cents: 1.5 },
    { amount_cents: -1 },
    { amount_cents: 1_000_000_000_001 },
    { period_end: "2025-12-31" },
    { period_end: "2026-02-30" },
    { notes: "x".repeat(5001) },
  ])("rejects invalid values %j", (patch) =>
    expect(budgetSchema.safeParse({ ...budget, ...patch }).success).toBe(false),
  );
  it("detects equal boundaries and containment", () => {
    expect(
      budgetsOverlap(budget, {
        ...budget,
        period_start: budget.period_end,
        period_end: "2026-02-28",
      }),
    ).toBe(true);
    expect(
      budgetsOverlap(budget, {
        ...budget,
        period_start: "2026-01-10",
        period_end: "2026-01-20",
      }),
    ).toBe(true);
  });
  it("allows adjacent nonoverlapping periods and distinct scopes", () => {
    expect(
      budgetsOverlap(budget, {
        ...budget,
        period_start: "2026-02-01",
        period_end: "2026-02-28",
      }),
    ).toBe(false);
    expect(budgetsOverlap(budget, { ...budget, brand_id: "different" })).toBe(
      false,
    );
    expect(budgetsOverlap(budget, { ...budget, season_id: "season" })).toBe(
      false,
    );
    expect(budgetsOverlap(budget, { ...budget, customer_id: "customer" })).toBe(
      false,
    );
  });
});
