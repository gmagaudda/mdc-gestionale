import { z } from "zod";
import type { InvoiceInput } from "../types";
export const ficRecordSchema = z.object({
  invoice_id: z.uuid(),
  company_id: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["prepared", "uncertain", "linked"]),
  document_id: z.number().int().positive().nullable(),
  document_number: z.string().nullable(),
});
export type FicRecord = z.infer<typeof ficRecordSchema>;
export interface FicInvoiceStore {
  prepare(
    input: InvoiceInput,
    companyId: number,
    fingerprint: string,
  ): Promise<FicRecord>;
  markAttempt(invoiceId: string): Promise<boolean>;
  definiteFailure(invoiceId: string): Promise<void>;
  link(invoiceId: string, documentId: number, number: string): Promise<void>;
  owns(companyId: number, documentId: number): Promise<boolean>;
  totals(
    companyId: number,
    documentId: number,
  ): Promise<Pick<InvoiceInput, "netCents" | "vatCents" | "grossCents"> | null>;
}
export async function invoiceFingerprint(input: InvoiceInput) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(input)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
