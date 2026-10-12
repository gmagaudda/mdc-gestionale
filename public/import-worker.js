/* Isolated, same-origin parser. No file content is executed or transmitted. */
importScripts("/vendor/exceljs-4.4.0.min.js", "/vendor/papaparse-5.7.0.min.js");
const limits = {
  bytes: 10485760,
  rows: 20000,
  sheets: 20,
  columns: 128,
  inflated: 104857600,
  entries: 1000,
};
const fail = (code) => {
  throw new Error(code);
};
async function checkZip(buffer) {
  const view = new DataView(buffer),
    size = buffer.byteLength;
  if (size < 22 || view.getUint32(0, true) !== 0x04034b50) fail("fileType");
  let end = -1;
  for (let i = size - 22; i >= Math.max(0, size - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === size
    ) {
      end = i;
      break;
    }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    fail("fileType");
  const count = view.getUint16(end + 10, true),
    centralSize = view.getUint32(end + 12, true);
  let pos = view.getUint32(end + 16, true),
    total = 0;
  if (!count || count > limits.entries || pos + centralSize !== end)
    fail("fileLimit");
  const names = new Set(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      fail("fileType");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true);
    const packed = view.getUint32(pos + 20, true),
      unpacked = view.getUint32(pos + 24, true);
    const nameSize = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true);
    const offset = view.getUint32(pos + 42, true);
    if (pos + 46 + nameSize + extra + comment > end) fail("fileType");
    const name = decoder.decode(new Uint8Array(buffer, pos + 46, nameSize));
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      names.has(name) ||
      /(^\/|\\|(^|\/)\.\.(\/|$)|vbaProject|externalLinks|\.bin$)/i.test(name)
    )
      fail("fileType");
    names.add(name);
    total += unpacked;
    if (
      total > limits.inflated ||
      unpacked > 31457280 ||
      unpacked > Math.max(1048576, packed * 200)
    )
      fail("fileLimit");
    if (
      offset + 30 > pos ||
      view.getUint32(offset, true) !== 0x04034b50 ||
      view.getUint16(offset + 8, true) !== method
    )
      fail("fileType");
    const localName = view.getUint16(offset + 26, true),
      localExtra = view.getUint16(offset + 28, true);
    const start = offset + 30 + localName + localExtra;
    if (
      start + packed > pos ||
      decoder.decode(new Uint8Array(buffer, offset + 30, localName)) !== name
    )
      fail("fileType");
    // Bound actual inflation as well as declared ZIP sizes before ExcelJS loads it.
    if (method === 8 && packed) {
      const stream = new Blob([buffer.slice(start, start + packed)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"));
      const reader = stream.getReader();
      let actual = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          actual += chunk.value.length;
          if (actual > unpacked || actual > 31457280) {
            await reader.cancel();
            fail("fileLimit");
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (actual !== unpacked) fail("fileType");
    } else if (method === 0 && packed !== unpacked) fail("fileType");
    pos += 46 + nameSize + extra + comment;
  }
  if (
    pos !== end ||
    !names.has("xl/workbook.xml") ||
    !names.has("[Content_Types].xml")
  )
    fail("fileType");
}
function scalar(value) {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "object" &&
    ("formula" in value || "sharedFormula" in value)
  )
    return scalar(value.result);
  if (typeof value === "object" && "error" in value)
    return { error: value.error };
  if (typeof value === "object" && "richText" in value)
    return value.richText.map((v) => v.text).join("");
  if (typeof value === "object" && "text" in value) return String(value.text);
  return null;
}
self.onmessage = async ({ data }) => {
  const { id, buffer, filename } = data;
  try {
    if (
      !(buffer instanceof ArrayBuffer) ||
      !buffer.byteLength ||
      buffer.byteLength > limits.bytes
    )
      fail("fileLimit");
    const extension = String(filename).split(".").pop()?.toLowerCase();
    const started = performance.now();
    let sheets = [],
      rowCount = 0;
    if (extension === "xlsx") {
      await checkZip(buffer);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer, {
        ignoreNodes: [
          "dataValidations",
          "conditionalFormatting",
          "drawing",
          "sheetProtection",
        ],
      });
      if (workbook.worksheets.length > limits.sheets) fail("fileLimit");
      for (const sheet of workbook.worksheets) {
        const rows = [];
        sheet.eachRow((row, number) => {
          const values = row.values.slice(1).map(scalar);
          if (values.some((v) => v !== null && v !== "")) {
            if (
              ++rowCount > limits.rows ||
              values.length > limits.columns ||
              number > 1048576
            )
              fail("fileLimit");
            rows.push({ number, values: Array.from(values, (v) => v ?? null) });
          }
        });
        sheets.push({ name: sheet.name, rows });
      }
    } else if (extension === "csv") {
      if (
        (buffer.byteLength >= 2 &&
          new DataView(buffer).getUint16(0, true) === 0x4b50) ||
        new Uint8Array(buffer).includes(0)
      )
        fail("fileType");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      const rows = [];
      let cursor = 0,
        physicalRow = 1;
      Papa.parse(text, {
        skipEmptyLines: false,
        step(result, parser) {
          if (result.errors.some((e) => e.code !== "UndetectableDelimiter"))
            fail("csvInvalid");
          const number = physicalRow;
          const segment = text.slice(cursor, result.meta.cursor);
          physicalRow += (segment.match(/\r\n|\r|\n/g) || []).length;
          cursor = result.meta.cursor;
          if (result.data.every((v) => String(v).trim() === "")) return;
          if (
            rows.length >= limits.rows ||
            result.data.length > limits.columns
          ) {
            parser.abort();
            fail("fileLimit");
          }
          rows.push({ number, values: result.data });
        },
      });
      sheets = [{ name: "CSV", rows }];
      rowCount = rows.length;
    } else fail("fileType");
    self.postMessage({
      id,
      ok: true,
      sheets,
      rowCount,
      durationMs: performance.now() - started,
    });
  } catch (error) {
    const known = ["fileType", "fileLimit", "csvInvalid"];
    self.postMessage({
      id,
      ok: false,
      error: known.includes(error?.message) ? error.message : "parseError",
    });
  }
};
