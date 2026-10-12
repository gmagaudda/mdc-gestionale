import { z } from "zod";
import { MAX_CENTS } from "@/lib/money";
const cents = z.number().int().min(0).max(MAX_CENTS);
const text = (max = 200) => z.string().trim().max(max);
export const externalStatusSchema = z.enum([
  "draft",
  "issued",
  "sent",
  "paid",
  "cancelled",
  "rejected",
]);
export type ExternalStatus = z.infer<typeof externalStatusSchema>;
export const invoicePartySchema = z.strictObject({
  legal_name: text().min(1),
  vat_number: text(30),
  tax_code: text(30),
  sdi_code: text(7),
  pec: text(254),
  address: z.strictObject({
    street: text(),
    postal_code: text(20),
    city: text(),
    province: text(10),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
});
export const invoiceLineSchema = z.strictObject({
  name: text().min(1),
  sku: text(80),
  variant: text(200),
  quantity: z.number().int().min(1).max(100000),
  unit_price_cents: cents,
  discount_pct: z
    .number()
    .min(0)
    .max(100)
    .refine((v) => Number(v.toFixed(2)) === v),
  vat_rate: z
    .number()
    .min(0)
    .max(100)
    .refine((v) => Number(v.toFixed(2)) === v),
  net_cents: cents,
  vat_cents: cents,
});
export const invoiceInputSchema = z
  .strictObject({
    invoiceId: z.uuid(),
    idempotencyKey: z.uuid(),
    orderId: z.uuid(),
    brandId: z.uuid(),
    number: text(80).min(1),
    issueDate: z.iso.date(),
    dueDate: z.iso.date(),
    currency: z.literal("EUR"),
    paymentTerms: text(500),
    orderDiscountPct: z
      .number()
      .min(0)
      .max(100)
      .refine((v) => Number(v.toFixed(2)) === v),
    supplier: invoicePartySchema,
    customer: invoicePartySchema,
    lines: z.array(invoiceLineSchema).min(1).max(5000),
    netCents: cents,
    vatCents: cents,
    grossCents: z
      .number()
      .int()
      .min(0)
      .max(MAX_CENTS * 2),
  })
  .superRefine((input, context) => {
    if (input.dueDate < input.issueDate)
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Invalid due date",
      });
    const net = input.lines.reduce(
      (sum, line) => sum + BigInt(line.net_cents),
      0n,
    );
    const vat = input.lines.reduce(
      (sum, line) => sum + BigInt(line.vat_cents),
      0n,
    );
    if (
      net !== BigInt(input.netCents) ||
      vat !== BigInt(input.vatCents) ||
      net + vat !== BigInt(input.grossCents)
    )
      context.addIssue({
        code: "custom",
        path: ["grossCents"],
        message: "Totals do not match snapshot lines",
      });
  });
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type InvoiceResult = { externalId: string; status: ExternalStatus };
export type InvoiceWebhook = InvoiceResult & { eventId: string };
export interface InvoicingProvider {
  createInvoice(input: InvoiceInput): Promise<InvoiceResult>;
  getStatus(externalId: string): Promise<ExternalStatus>;
  cancelInvoice(externalId: string): Promise<void>;
  parseWebhook(request: Request): Promise<InvoiceWebhook>;
}
export class InvoicingError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "not_found"
      | "conflict"
      | "invalid_transition"
      | "unauthorized"
      | "unavailable",
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "InvoicingError";
  }
}
