import { z } from "zod";
import {
  InvoicingError,
  type InvoiceInput,
  type ExternalStatus,
} from "../types";
export const idSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
const amount = z.number().finite().nonnegative();
export const totalsSchema = z.object({
  amount_net: amount,
  amount_vat: amount,
  amount_gross: amount,
});
export const documentSchema = totalsSchema.extend({
  id: idSchema,
  type: z.literal("invoice"),
  number: z.number().int().positive(),
  numeration: z.string().max(100),
  date: z.iso.date(),
  subject: z.string(),
  currency: z.object({ id: z.literal("EUR") }),
  entity: z.object({
    name: z.string(),
    vat_number: z.string().nullable().optional(),
    tax_code: z.string().nullable().optional(),
  }),
  e_invoice: z.boolean(),
  locked: z.boolean().nullish(),
  ei_status: z
    .enum([
      "attempt",
      "missing",
      "not_sent",
      "sent",
      "pending",
      "processing",
      "error",
      "discarded",
      "not_delivered",
      "accepted",
      "rejected",
      "no_response",
      "manual_accepted",
      "manual_rejected",
    ])
    .nullish(),
  payments_list: z
    .array(
      z.object({ amount, status: z.enum(["not_paid", "paid", "reversed"]) }),
    )
    .max(5000),
});
export type FicDocument = z.infer<typeof documentSchema>;
export const preCreateSchema = z.object({
  countries_list: z.array(z.string()).max(300),
  vat_types_list: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        value: z.number(),
        is_disabled: z.boolean().nullish(),
      }),
    )
    .max(1000),
});
// External decimals are checked at the boundary; business calculations stay integer cents.
export function decimalCents(value: number): bigint {
  if (!Number.isFinite(value) || value < 0 || value > 20000000000)
    throw new InvoicingError("conflict");
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.0005)
    throw new InvoicingError("conflict");
  return BigInt(cents);
}
export function checkTotals(
  totals: z.infer<typeof totalsSchema>,
  input: Pick<InvoiceInput, "netCents" | "vatCents" | "grossCents">,
) {
  if (
    decimalCents(totals.amount_net) !== BigInt(input.netCents) ||
    decimalCents(totals.amount_vat) !== BigInt(input.vatCents) ||
    decimalCents(totals.amount_gross) !== BigInt(input.grossCents)
  )
    throw new InvoicingError("conflict");
}
export function documentStatus(doc: FicDocument): ExternalStatus {
  if (
    ["discarded", "rejected", "manual_rejected"].includes(doc.ei_status ?? "")
  )
    return "rejected";
  if (
    doc.payments_list.length &&
    doc.payments_list.every((p) => p.status === "paid") &&
    doc.payments_list.reduce((sum, p) => sum + decimalCents(p.amount), 0n) ===
      decimalCents(doc.amount_gross)
  )
    return "paid";
  if (
    [
      "sent",
      "processing",
      "not_delivered",
      "accepted",
      "no_response",
      "manual_accepted",
    ].includes(doc.ei_status ?? "")
  )
    return "sent";
  // Creating an API document does not submit it to SdI. Operational errors are retryable, not rejection.
  return "issued";
}
export function externalFicId(companyId: number, documentId: number) {
  return `fic_${companyId}_${documentId}`;
}
export function parseExternalFicId(value: string) {
  const match = /^fic_([1-9]\d{0,15})_([1-9]\d{0,15})$/.exec(value);
  if (
    !match ||
    !idSchema.safeParse(Number(match[1])).success ||
    !idSchema.safeParse(Number(match[2])).success
  )
    throw new InvoicingError("not_found");
  return { companyId: Number(match[1]), documentId: Number(match[2]) };
}
