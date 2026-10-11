export const MAX_CENTS = 1_000_000_000_000;
export function parseCents(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(/[.,]/);
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(MAX_CENTS) ? Number(cents) : null;
}
export function centsToDecimal(value: number | bigint): string {
  const cents = BigInt(value);
  const amount = cents < 0 ? -cents : cents;
  return `${cents < 0 ? "-" : ""}${amount / 100n},${String(amount % 100n).padStart(2, "0")}`;
}
export function formatMoney(value: number | bigint): string {
  const cents = BigInt(value);
  const amount = cents < 0 ? -cents : cents;
  const parts = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).formatToParts(amount / 100n);
  return `${cents < 0 ? "-" : ""}${parts.map((part) => (part.type === "fraction" ? String(amount % 100n).padStart(2, "0") : part.value)).join("")}`;
}
