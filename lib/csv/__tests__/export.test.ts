import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import { exportCsv } from "@/lib/csv";
describe("CSV exports", () => {
  it("round trips delimiters quotes and newlines while neutralizing spreadsheet formulae", () => {
    const result = exportCsv(
      ["Cliente", "Importo"],
      [
        [`Boutique; "Èté"\nMilano`, "12,34"],
        ['=HYPERLINK("x")', 0],
        ["@SUM(A1)", 12],
      ],
    );
    expect(result.startsWith("\uFEFF")).toBe(true);
    const parsed = Papa.parse<string[]>(result, { delimiter: ";" });
    expect(parsed.data[1]).toEqual([`Boutique; "Èté"\nMilano`, "12,34"]);
    expect(parsed.data[2][0]).toBe('\'=HYPERLINK("x")');
    expect(parsed.data[3][0]).toBe("'@SUM(A1)");
  });
});
