import { beforeAll, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { validateImportFile, maxImportSize } from "./file";
let sample: Uint8Array;
beforeAll(async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Synthetic").addRow(["Brand", 100]);
  sample = new Uint8Array(await book.xlsx.writeBuffer());
});
it("checks actual type independently of declared filename", () => {
  expect(validateImportFile("sample.xlsx", sample)).toBe("xlsx");
  expect(validateImportFile("sample.xlsm", sample)).toBeNull();
  expect(validateImportFile("sample.csv", sample)).toBeNull();
  expect(
    validateImportFile("fake.xlsx", new TextEncoder().encode("a,b\n1,2")),
  ).toBeNull();
  expect(validateImportFile("tiny.csv", new TextEncoder().encode("x"))).toBe(
    "csv",
  );
  expect(
    validateImportFile("binary.csv", new Uint8Array([0, 1, 2])),
  ).toBeNull();
  expect(
    validateImportFile("large.xlsx", new Uint8Array(maxImportSize + 1)),
  ).toBeNull();
});
it("rejects broken local offsets and declared ZIP inflation", () => {
  const broken = sample.slice(),
    view = new DataView(broken.buffer);
  let central = 0;
  for (let p = 0; p < broken.length - 4; p++)
    if (view.getUint32(p, true) === 0x02014b50) {
      central = p;
      break;
    }
  expect(central).toBeGreaterThan(0);
  view.setUint32(central + 42, central, true);
  expect(validateImportFile("bad.xlsx", broken)).toBeNull();
  const inflated = sample.slice();
  new DataView(inflated.buffer).setUint32(central + 24, 104857601, true);
  expect(validateImportFile("bomb.xlsx", inflated)).toBeNull();
});
