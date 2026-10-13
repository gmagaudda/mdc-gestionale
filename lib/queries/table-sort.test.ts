import { expect, test } from "vitest";
import { tableSortValue } from "./table-sort";
const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
test("sorts formatted cents exactly, including negative and very large totals", () => {
  const values = [
    "-10,00 €",
    "-2,00 €",
    "0,00 €",
    "9,00 €",
    "10,00 €",
    "1.000,00 €",
    "90.071.992.547.409,91 €",
    "90.071.992.547.409,92 €",
  ];
  for (let index = 1; index < values.length; index++)
    expect(
      collator.compare(
        String(tableSortValue(values[index - 1])),
        String(tableSortValue(values[index])),
      ),
    ).toBeLessThan(0);
});
test("Italian dates sort by year, month, day and time, with null preserved", () => {
  expect(tableSortValue("31/01/2026")).toBe("2026-01-31");
  expect(tableSortValue("01/02/2026, 12:35:00")).toBe("2026-02-01, 12:35:00");
  expect(tableSortValue(null)).toBeNull();
  expect(tableSortValue("SS27")).toBe("SS27");
  expect(tableSortValue(12)).toBe(12);
  expect(tableSortValue("12,25%")).toBe(12.25);
  expect(tableSortValue("12,5%")).toBe(12.5);
});
