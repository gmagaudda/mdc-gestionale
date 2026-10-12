import { describe, expect, it } from "vitest";
import {
  matchKey,
  normalizeCents,
  normalizeDate,
  normalizeQuantity,
  normalizeText,
  validVatNumber,
} from "./normalize";
describe("money normalization without implicit locale guessing", () => {
  it.each([
    ["1.234,56 €", "it", 123456],
    ["1.234", "it", 123400],
    ["1,23", "it", 123],
    ["0", "it", 0],
    [0, "it", 0],
    ["  12,50 € ", "it", 1250],
    ["+10", "it", 1000],
    ["1,234.56", "en", 123456],
    ["1.234", "en", null],
    ["12.50", "en", 1250],
    [1234.56, "it", 123456],
    [0.1 + 0.2, "it", 30],
    [1.001, "it", null],
    [1e-7, "it", null],
    [1e-9, "it", null],
    [null, "it", null],
    [" ", "it", null],
    ["testo", "it", null],
    [true, "it", null],
    ["-1", "it", null],
    ["1.23,00", "it", null],
    ["1,000,00", "it", null],
    ["=SUM(A1)", "it", null],
    ["Infinity", "en", null],
    [1e20, "it", null],
    ["10.000.000.000,00", "it", 1000000000000],
    ["10.000.000.000,01", "it", null],
  ] as const)("%s (%s)", (value, format, expected) =>
    expect(normalizeCents(value, format)).toBe(expected),
  );
});
describe("dates, identity and quantities", () => {
  it.each([
    ["29/02/2024", "2024-02-29"],
    ["29/02/2027", null],
    ["31/04/2027", null],
    ["2027-01-15", "2027-01-15"],
    ["1/2/2027", "2027-02-01"],
    ["03/04/27", null],
    [1, "1900-01-01"],
    [59, "1900-02-28"],
    [60, null],
    [61, "1900-03-01"],
    [0, null],
    [1.5, null],
  ] as const)("date %s", (v, result) => expect(normalizeDate(v)).toBe(result));
  it("normalizes equivalent legal names without inventing data", () => {
    expect(matchKey(" Acmè S.r.l. ")).toBe(matchKey("ACME srl"));
    expect(normalizeText("EUROPE \n ")).toBe("EUROPE");
  });
  it("checks VAT checksum", () => {
    expect(validVatNumber("01114601006")).toBe(true);
    expect(validVatNumber("01114601007")).toBe(false);
    expect(validVatNumber("123")).toBe(false);
  });
  it("requires positive integral quantities", () => {
    expect(normalizeQuantity("2")).toBe(2);
    for (const v of ["", null, 0, -1, 1.5, "abc"])
      expect(normalizeQuantity(v)).toBe(null);
  });
});
