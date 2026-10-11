import { it, expect } from "vitest";
import { parseCents, centsToDecimal, formatMoney } from "..";
it("parses decimal money exactly and refuses ambiguous formats", () => {
  expect(parseCents("123,45")).toBe(12345);
  expect(parseCents("0.1")).toBe(10);
  expect(parseCents("1.234")).toBeNull();
  expect(parseCents("-10")).toBeNull();
  expect(parseCents("10000000000,01")).toBeNull();
  expect(centsToDecimal(12345)).toBe("123,45");
});
it("formats bigint amounts without losing cents", () => {
  expect(formatMoney(9007199254740993n).replace(/\s/g, " ")).toBe(
    "90.071.992.547.409,93 €",
  );
  expect(formatMoney(-1)).toBe("-0,01 €");
});
