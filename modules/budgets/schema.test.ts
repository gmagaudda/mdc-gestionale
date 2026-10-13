import { describe, it, expect } from "vitest";
import { budgetSchema } from "./schema";
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
});
