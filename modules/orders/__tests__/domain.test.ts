import { it, expect } from "vitest";
import { allowedTransitions, canTransition } from "../domain";
import { orderStatuses, orderSchema } from "../schema";
it("limits transitions by state and role", () => {
  expect(allowedTransitions("draft", "staff")).toEqual([
    "confirmed",
    "cancelled",
  ]);
  expect(allowedTransitions("delivered", "accounting")).toEqual(["invoiced"]);
  for (const status of orderStatuses) {
    expect(allowedTransitions(status, "brand")).toEqual([]);
    if (status !== "delivered")
      expect(allowedTransitions(status, "accounting")).toEqual([]);
  }
  expect(canTransition("draft", "shipped", "admin")).toBe(false);
  expect(allowedTransitions("invoiced", "admin")).toEqual([]);
});
it("rejects invalid header dates and duplicate variant lines", () => {
  const header = {
    brand_id: "00000000-0000-4000-8000-000000000001",
    customer_id: "00000000-0000-4000-8000-000000000002",
    season_id: "00000000-0000-4000-8000-000000000003",
    order_date: "2026-10-12",
    delivery_date: "",
    payment_terms: "",
    discount_pct: 0,
    commission_pct_override: null,
    internal_notes: "",
  };
  const line = {
    variant_id: "00000000-0000-4000-8000-000000000004",
    quantity: 1,
    unit_price_cents: 1250,
    discount_pct: 0,
  };
  expect(orderSchema.safeParse({ header, lines: [line] }).success).toBe(true);
  expect(orderSchema.safeParse({ header, lines: [line, line] }).success).toBe(
    false,
  );
  expect(
    orderSchema.safeParse({
      header: { ...header, delivery_date: "2026-01-01" },
      lines: [],
    }).success,
  ).toBe(false);
});
