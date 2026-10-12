import type { ParsedSheet } from "./parser";
// Leave room for the Server Action envelope under Next's 1 MiB body limit.
export function importChunks(rows: ParsedSheet["rows"], maxBytes = 650000) {
  const result: ParsedSheet["rows"][] = [];
  let chunk: ParsedSheet["rows"] = [],
    bytes = 2;
  for (const row of rows) {
    const size = new TextEncoder().encode(JSON.stringify(row)).length + 1;
    if (size > maxBytes) throw Error("rowSize");
    if (chunk.length && (chunk.length === 500 || bytes + size > maxBytes)) {
      result.push(chunk);
      chunk = [];
      bytes = 2;
    }
    chunk.push(row);
    bytes += size;
  }
  if (chunk.length) result.push(chunk);
  return result;
}
