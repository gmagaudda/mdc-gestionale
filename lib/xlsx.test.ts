import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { exportXlsx, safeSpreadsheetText } from "./xlsx";
describe("safe XLSX exports", () => {
  it.each(["=SUM(A1:A2)", "+cmd", "-cmd", "@cmd", "  =cmd", "\tcmd", "\r=cmd"])(
    "escapes formula-like text %s",
    (input) => {
      expect(safeSpreadsheetText(input)).toBe(`'${input}`);
    },
  );
  it("preserves text values and exact oversized integer cents without formulas", async () => {
    const bytes = await exportXlsx([
      {
        name: "Ordini",
        fields: ["Brand", "Centesimi", "Ordini"],
        rows: [['=HYPERLINK("bad")', "900719925474099312345", 3]],
      },
    ]);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes.buffer);
    const row = book.getWorksheet("Ordini")!.getRow(2);
    expect(row.getCell(1).value).toBe('\'=HYPERLINK("bad")');
    expect(row.getCell(2).value).toBe("900719925474099312345");
    expect(row.getCell(3).value).toBe(3);
    expect(row.getCell(1).type).toBe(ExcelJS.ValueType.String);
  });
});
