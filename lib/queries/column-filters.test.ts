import { expect, it } from "vitest";
import { parseColumnFilters, applyColumnFilters } from "./column-filters";
import {
  listHref,
  parseListQuery,
  captureColumnFilters,
  columnFilterParams,
} from "./list";
import { exportSelectionSchema } from "@/lib/exports/selection";

it("normalizes exact cents and validates actual calendar dates", () => {
  expect(
    parseColumnFilters(
      { amount_cents: " 123,45 ", period_start: "2034-01-01", period_end: "" },
      "budgets",
    ),
  ).toEqual({
    ok: true,
    data: { amount_cents: "12345", period_start: "2034-01-01" },
  });
  expect(
    parseColumnFilters({ wholesale_price_cents: "10000000000.00" }, "products"),
  ).toEqual({ ok: true, data: { wholesale_price_cents: "1000000000000" } });
  for (const amount of ["-1", "1.001", "1e2", "10.000,00", "10000000000.01"])
    expect(parseColumnFilters({ amount_cents: amount }, "budgets").ok).toBe(
      false,
    );
  for (const date of ["2034-02-30", "2034-13-01", "01/01/2034", "0000-01-01"])
    expect(parseColumnFilters({ period_start: date }, "budgets").ok).toBe(
      false,
    );
});
it("rejects unknown fields, repeated parameters and out-of-range values", () => {
  for (const input of [
    { notes: "" },
    { city: ["Roma"] },
    { city: "x".repeat(101) },
    { "city;drop table": "Roma" },
  ])
    expect(parseColumnFilters(input, "customers").ok).toBe(false);
  expect(parseColumnFilters({ size_bytes: "010485760" }, "documents")).toEqual({
    ok: true,
    data: { size_bytes: "10485760" },
  });
  for (const value of ["10485761", "-1", "1.5", "1e3"])
    expect(parseColumnFilters({ size_bytes: value }, "documents").ok).toBe(
      false,
    );
  expect(parseColumnFilters(undefined, "brands")).toEqual({
    ok: true,
    data: {},
  });
});
it("preserves non-date column and domain filters in sort and page links", () => {
  const query = parseListQuery(
    { q: " invoice ", cf_gross_cents: "122,00", cf_due_date: "2026-01-31" },
    ["number"],
  );
  const params = new URL(
    listHref(
      "/invoices",
      query,
      { page: 2, direction: "desc" },
      { status: "issued" },
    ),
    "http://localhost",
  ).searchParams;
  expect(Object.fromEntries(params)).toMatchObject({
    cf_gross_cents: "122,00",
    status: "issued",
    page: "2",
    direction: "desc",
  });
  expect(params.has("cf_due_date")).toBe(false);
  expect(captureColumnFilters(Object.fromEntries(params))).toEqual(
    query.columnFilters,
  );
  expect(columnFilterParams(query.columnFilters)).toEqual({
    cf_gross_cents: "122,00",
  });
  expect(
    listHref("/invoices", query, { columnFilters: undefined }),
  ).not.toContain("cf_");
});
it("escapes LIKE metacharacters and uses equality for typed values", () => {
  const calls: unknown[] = [];
  const request = {
    ilike: (key: string, value: string) => {
      calls.push([key, value]);
      return request;
    },
    eq: (key: string, value: unknown) => {
      calls.push([key, value]);
      return request;
    },
  };
  applyColumnFilters(request, "products", {
    name: "100%_\\",
    wholesale_price_cents: "12345",
  });
  expect(calls).toEqual([
    ["name", "%100\\%\\_\\\\%"],
    ["wholesale_price_cents", "12345"],
  ]);
});
it("requires a bounded nonempty UUID selection and deduplicates it", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(exportSelectionSchema.parse(`${id},${id}`)).toEqual([id]);
  expect(exportSelectionSchema.parse(undefined)).toBeUndefined();
  for (const input of ["", "bad", `${id},`, Array(501).fill(id).join(",")])
    expect(exportSelectionSchema.safeParse(input).success).toBe(false);
});
