import { MAX_CENTS } from "@/lib/money";
import type { ImportCell } from "./parser";
export function normalizeText(value: ImportCell | undefined): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).normalize("NFKC").replace(/\s+/g, " ").trim()
    : "";
}
export function matchKey(value: ImportCell | undefined): string {
  return normalizeText(value)
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\bs\s*\.?\s*r\s*\.?\s*l\s*\.?\b/g, "srl")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function normalizeCents(
  value: ImportCell | undefined,
  format: "it" | "en" = "it",
): number | null {
  if (value === null || value === undefined || normalizeText(value) === "")
    return null;
  let text = normalizeText(value).replace(/€/g, "").replace(/\s/g, "");
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > MAX_CENTS / 100)
      return null;
    // XLSX numbers are typed values, independent of the selected textual locale.
    text = String(value);
    if (
      Math.abs(value - Number(value.toFixed(2))) >
      Number.EPSILON * Math.max(1, value) * 4
    )
      return null;
    if (/e/i.test(text)) text = value.toFixed(2);
  } else if (format === "it") {
    if (!/^\+?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text))
      return null;
    text = text.replaceAll(".", "").replace(",", ".");
  } else {
    if (!/^\+?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))
      return null;
    text = text.replaceAll(",", "");
  }
  if (!/^\+?\d+(?:\.\d+)?$/.test(text)) return null;
  const [whole, decimals = ""] = text.replace(/^\+/, "").split(".");
  // Accept only floating-point noise beyond cents, not a genuine third decimal.
  if (
    decimals.length > 2 &&
    Math.abs(Number(text) - Number(Number(text).toFixed(2))) > 1e-8
  )
    return null;
  const rounded =
    decimals.length > 2
      ? Number(text).toFixed(2).split(".")
      : [whole, decimals];
  const cents =
    BigInt(rounded[0]) * 100n + BigInt((rounded[1] ?? "").padEnd(2, "0"));
  return cents <= BigInt(MAX_CENTS) ? Number(cents) : null;
}
export function normalizeDate(
  value: ImportCell | undefined,
  format: "dmy" | "ymd" = "dmy",
): string | null {
  if (typeof value === "number") {
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value === 60 ||
      value > 2958465
    )
      return null;
    const epoch = Date.UTC(1899, 11, 31),
      days = value > 60 ? value - 1 : value;
    return new Date(epoch + days * 86400000).toISOString().slice(0, 10);
  }
  const text = normalizeText(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text),
    local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const parts = iso
    ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : format === "dmy" && local
      ? [Number(local[3]), Number(local[2]), Number(local[1])]
      : null;
  if (!parts || parts[0] < 1900 || parts[0] > 9999) return null;
  const [y, m, d] = parts,
    date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date.toISOString().slice(0, 10)
    : null;
}
export function validVatNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = Number(value[i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}
export function normalizeQuantity(
  value: ImportCell | undefined,
): number | null {
  const n = Number(normalizeText(value));
  return Number.isSafeInteger(n) && n > 0 && n <= 1000000 ? n : null;
}
