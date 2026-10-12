import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { InvoicingError, type InvoiceInput } from "../types";
import { ficRecordSchema, type FicInvoiceStore } from "./store";
function fail(code: string) {
  throw new InvoicingError(
    code === "23505" || code === "55P03"
      ? "conflict"
      : code === "P0002"
        ? "not_found"
        : "unavailable",
    code !== "23505" && code !== "55P03",
  );
}
export class SupabaseFicInvoiceStore implements FicInvoiceStore {
  constructor(private readonly db: SupabaseClient<Database>) {}
  async prepare(input: InvoiceInput, companyId: number, fingerprint: string) {
    const result = await this.db.rpc("fic_prepare_invoice", {
      p_id: input.invoiceId,
      p_company_id: companyId,
      p_fingerprint: fingerprint,
    });
    if (result.error) fail(result.error.code);
    const parsed = ficRecordSchema.safeParse(result.data);
    if (!parsed.success) throw new InvoicingError("unavailable");
    return parsed.data;
  }
  async markAttempt(invoiceId: string) {
    const result = await this.db.rpc("fic_mark_attempt", { p_id: invoiceId });
    if (result.error) fail(result.error.code);
    return result.data === true;
  }
  async definiteFailure(invoiceId: string) {
    const result = await this.db.rpc("fic_definite_failure", {
      p_id: invoiceId,
    });
    if (result.error) fail(result.error.code);
  }
  async link(invoiceId: string, documentId: number, number: string) {
    const result = await this.db.rpc("fic_link_invoice", {
      p_id: invoiceId,
      p_document_id: documentId,
      p_number: number,
    });
    if (result.error) fail(result.error.code);
  }
  async totals(companyId: number, documentId: number) {
    const result = await this.db
      .from("invoices")
      .select("net_cents,vat_cents,gross_cents")
      .eq("provider", "fic")
      .eq("fic_company_id", companyId)
      .eq("fic_document_id", documentId)
      .maybeSingle();
    if (result.error) fail(result.error.code);
    return result.data
      ? {
          netCents: result.data.net_cents,
          vatCents: result.data.vat_cents,
          grossCents: result.data.gross_cents,
        }
      : null;
  }
  async owns(companyId: number, documentId: number) {
    const result = await this.db
      .from("invoices")
      .select("id")
      .eq("provider", "fic")
      .eq("fic_company_id", companyId)
      .eq("fic_document_id", documentId)
      .maybeSingle();
    if (result.error) fail(result.error.code);
    return !!result.data;
  }
}
