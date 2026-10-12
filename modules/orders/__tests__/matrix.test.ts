import { it, expect } from "vitest";
import { matrixTotals, validQuantity } from "../components/size-color-matrix";
const variants = [
  { id: "1", size: "S", color: "Blu", sku: "1" },
  { id: "2", size: "M", color: "Blu", sku: "2" },
  { id: "3", size: "S", color: "Nero", sku: "3" },
];
it("totals matrix rows columns and sparse variants", () => {
  expect(matrixTotals(variants, { "1": 2, "2": 3, "3": 4 })).toEqual({
    rows: { Blu: 5, Nero: 4 },
    columns: { S: 6, M: 3 },
    total: 9,
  });
  expect(matrixTotals([], {}).total).toBe(0);
});
it("isolates invalid cells and handles maximum quantities", () => {
  expect(validQuantity(-1)).toBe(false);
  expect(validQuantity(1.5)).toBe(false);
  expect(validQuantity(100001)).toBe(false);
  expect(matrixTotals(variants, { "1": 100000, "2": NaN, "3": -1 }).total).toBe(
    100000,
  );
});
