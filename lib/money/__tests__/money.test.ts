import { it, expect } from "vitest";
import {
  parseCents,
  centsToDecimal,
  formatMoney,
  calculateLine,
  roundRatio,
} from "..";
it("parses decimal money exactly and refuses ambiguous formats", () => {
  expect(parseCents("123,45")).toBe(12345);
  expect(parseCents("0.1")).toBe(10);
  expect(parseCents("1.234")).toBeNull();
  expect(parseCents("-10")).toBeNull();
  expect(parseCents("10000000000,01")).toBeNull();
  expect(centsToDecimal(12345)).toBe("123,45");
});
it("rounds combined discounts and line VAT once at half cents", () => {
  expect(
    calculateLine({
      quantity: 3,
      unitPriceCents: 1999,
      lineDiscount: 12.5,
      orderDiscount: 10,
      vatRate: 22,
    }),
  ).toEqual({ net: 4723n, vat: 1039n, gross: 5762n });
  expect(
    calculateLine({
      quantity: 1,
      unitPriceCents: 1,
      lineDiscount: 50,
      vatRate: 22,
    }).net,
  ).toBe(1n);
  expect(
    calculateLine({ quantity: 1, unitPriceCents: 100, orderDiscount: 100 }),
  ).toEqual({ net: 0n, vat: 0n, gross: 0n });
  expect(roundRatio(100000000000000005n, 10n)).toBe(10000000000000001n);
});
it("formats bigint amounts without losing cents", () => {
  expect(formatMoney(9007199254740993n).replace(/\s/g, " ")).toBe(
    "90.071.992.547.409,93 €",
  );
  expect(formatMoney(-1)).toBe("-0,01 €");
});
