import ExcelJS from "exceljs";
// User text is always a string cell, never a formula object. Prefix dangerous
// leading characters as a second barrier for conversion to CSV by spreadsheet apps.
export function safeSpreadsheetText(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)
    ? `'${value}`
    : value;
}
export type ExportSheet = {
  name: string;
  fields: string[];
  rows: (string | number)[][];
};
export async function exportXlsx(
  sheets: ExportSheet[],
): Promise<Uint8Array<ArrayBuffer>> {
  const book = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = book.addWorksheet(sheet.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.addRow(sheet.fields.map(safeSpreadsheetText));
    for (const row of sheet.rows)
      ws.addRow(
        row.map((v) => (typeof v === "string" ? safeSpreadsheetText(v) : v)),
      );
    ws.columns.forEach((col) => {
      col.width = 28;
    });
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.fields.length },
    };
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
