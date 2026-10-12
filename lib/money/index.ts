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
export function percentageBasisPoints(value: number): bigint {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    Number(value.toFixed(2)) !== value
  )
    throw Error("Invalid percentage");
  return BigInt(value.toFixed(2).replace(".", ""));
}
export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw Error("Invalid amount");
  return (numerator + denominator / 2n) / denominator;
}
export function calculateLine({
  quantity,
  unitPriceCents,
  lineDiscount = 0,
  orderDiscount = 0,
  vatRate = 22,
}: {
  quantity: number;
  unitPriceCents: number;
  lineDiscount?: number;
  orderDiscount?: number;
  vatRate?: number;
}): { net: bigint; vat: bigint; gross: bigint } {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    !Number.isSafeInteger(unitPriceCents) ||
    unitPriceCents < 0
  )
    throw Error("Invalid amount");
  const net = roundRatio(
    BigInt(quantity) *
      BigInt(unitPriceCents) *
      (10000n - percentageBasisPoints(lineDiscount)) *
      (10000n - percentageBasisPoints(orderDiscount)),
    100000000n,
  );
  const vat = roundRatio(net * percentageBasisPoints(vatRate), 10000n);
  return { net, vat, gross: net + vat };
}
