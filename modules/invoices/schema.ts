import { z } from "zod";
import { parseCents } from "@/lib/money";
export const generateInvoiceSchema = z
  .strictObject({
    orderId: z.uuid(),
    issueDate: z.iso.date(),
    dueDate: z.iso.date(),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"] });
export const paymentSchema = z.strictObject({
  invoiceId: z.uuid(),
  idempotencyKey: z.uuid(),
  amount: z
    .string()
    .trim()
    .refine((v) => {
      const c = parseCents(v);
      return c !== null && c > 0;
    })
    .transform((v) => parseCents(v)!),
  paidDate: z.iso.date(),
  method: z.enum(["bank_transfer", "cash", "card", "other"]),
  note: z.string().trim().max(1000),
});
