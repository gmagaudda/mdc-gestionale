export const maxImportSize = 10485760;
export function validateImportFile(
  filename: string,
  bytes: Uint8Array,
): "xlsx" | "csv" | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (
    !bytes.length ||
    bytes.length > maxImportSize ||
    !["xlsx", "csv"].includes(extension ?? "")
  )
    return null;
  if (extension === "csv") {
    if (
      bytes.includes(0) ||
      (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b)
    )
      return null;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return "csv";
    } catch {
      return null;
    }
  }
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length < 22 || v.getUint32(0, true) !== 0x04034b50) return null;
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
      if (
        v.getUint32(i, true) === 0x06054b50 &&
        i + 22 + v.getUint16(i + 20, true) === bytes.length
      ) {
        end = i;
        break;
      }
    if (end < 0 || v.getUint16(end + 4, true) || v.getUint16(end + 6, true))
      return null;
    const count = v.getUint16(end + 10, true),
      length = v.getUint32(end + 12, true);
    let p = v.getUint32(end + 16, true),
      total = 0;
    const centralStart = p;
    if (count < 1 || count > 1000 || p + length !== end) return null;
    const names = new Set<string>(),
      decode = new TextDecoder("utf-8", { fatal: true });
    for (let i = 0; i < count; i++) {
      if (p + 46 > end || v.getUint32(p, true) !== 0x02014b50) return null;
      const nameLen = v.getUint16(p + 28, true),
        extra = v.getUint16(p + 30, true),
        comment = v.getUint16(p + 32, true),
        packed = v.getUint32(p + 20, true),
        inflated = v.getUint32(p + 24, true);
      if (
        p + 46 + nameLen + extra + comment > end ||
        v.getUint16(p + 8, true) & 1 ||
        ![0, 8].includes(v.getUint16(p + 10, true))
      )
        return null;
      const name = decode.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      const offset = v.getUint32(p + 42, true),
        method = v.getUint16(p + 10, true);
      if (
        offset + 30 > centralStart ||
        v.getUint32(offset, true) !== 0x04034b50 ||
        v.getUint16(offset + 8, true) !== method ||
        v.getUint16(offset + 6, true) & 1
      )
        return null;
      const localName = v.getUint16(offset + 26, true),
        localExtra = v.getUint16(offset + 28, true),
        start = offset + 30 + localName + localExtra;
      if (
        start + packed > centralStart ||
        decode.decode(bytes.subarray(offset + 30, offset + 30 + localName)) !==
          name ||
        (method === 0 && packed !== inflated)
      )
        return null;
      total += inflated;
      if (
        names.has(name) ||
        /(^\/|\\|(^|\/)\.\.(\/|$)|vbaProject|externalLinks|\.bin$)/i.test(
          name,
        ) ||
        total > 104857600 ||
        inflated > 31457280 ||
        inflated > Math.max(1048576, packed * 200)
      )
        return null;
      names.add(name);
      p += 46 + nameLen + extra + comment;
    }
    return p === end &&
      names.has("xl/workbook.xml") &&
      names.has("[Content_Types].xml")
      ? "xlsx"
      : null;
  } catch {
    return null;
  }
}
