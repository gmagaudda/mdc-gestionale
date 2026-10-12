import { it, expect } from "vitest";
import { orderFiltersSchema, orderListQuery, filterParams } from "../filters";
import { listHref } from "@/lib/queries/list";
it("rejects invalid period and ids instead of exporting a broader result", () => {
  expect(
    orderFiltersSchema.safeParse({ from: "2026-10-20", to: "2026-10-01" })
      .success,
  ).toBe(false);
  expect(orderFiltersSchema.safeParse({ customer_id: "bad" }).success).toBe(
    false,
  );
  expect(orderFiltersSchema.safeParse({ status: "other" }).success).toBe(false);
});
it("preserves order filters when paginating and whitelists sorting", () => {
  const filters = orderFiltersSchema.parse({
    status: "confirmed",
    from: "2026-01-01",
  });
  const query = orderListQuery({ sort: "internal_notes" });
  const url = new URL(
    listHref("/orders", query, { page: 2 }, filterParams(filters)),
    "http://localhost",
  );
  expect(url.searchParams.get("status")).toBe("confirmed");
  expect(url.searchParams.get("from")).toBe("2026-01-01");
  expect(url.searchParams.get("page")).toBe("2");
  expect(query.sort).toBe("order_date");
});
