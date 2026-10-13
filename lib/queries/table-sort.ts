// Display formatting must not turn numbers and Italian dates into text ordering.
export function tableSortValue(value: string | number | null | undefined) {
  if (typeof value !== "string") return value ?? null;
  const amount = value.replace(/[\s€]/g, "");
  if (/^-?[\d.]+,\d{2}$/.test(amount) && value.includes("€"))
    // Keep cents exact, including aggregate values above Number.MAX_SAFE_INTEGER.
    // A positive offset preserves signed order with Arc's numeric text collator.
    return String(
      (1n << 128n) + BigInt(amount.replaceAll(".", "").replace(",", "")),
    );
  if (/^-?[\d.]+(?:,\d+)?%$/.test(value.replaceAll(" ", "")))
    return Number(value.replace(/[.%\s]/g, "").replace(",", "."));
  const date = /^(\d{2})\/(\d{2})\/(\d{4})(.*)$/.exec(value);
  return date ? `${date[3]}-${date[2]}-${date[1]}${date[4]}` : value;
}
