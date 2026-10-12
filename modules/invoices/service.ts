import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createInvoicingProvider } from "@/lib/invoicing";
import { invoiceInputSchema, InvoicingError } from "@/lib/invoicing/types";
export async function issueInvoice(id: string) {
  const db = await createClient();
  const { data: lease, error: claimError } = await db.rpc(
    "claim_invoice_issue",
    { p_id: id },
  );
  if (claimError)
    throw new InvoicingError(
      claimError.code === "55P03" ? "conflict" : "unavailable",
      claimError.code !== "55P03",
    );
  if (!lease) return id;
  try {
    const { data: invoice, error } = await db
      .from("invoices")
      .select(
        "id,idempotency_key,order_id,brand_id,number,issue_date,due_date,currency,payment_terms,order_discount_pct,supplier_snapshot,customer_snapshot,lines_snapshot,net_cents,vat_cents,gross_cents,provider",
      )
      .eq("id", id)
      .single();
    if (error || !invoice) throw new InvoicingError("unavailable", true);
    const parsed = invoiceInputSchema.safeParse({
      invoiceId: invoice.id,
      idempotencyKey: invoice.idempotency_key,
      orderId: invoice.order_id,
      brandId: invoice.brand_id,
      number: invoice.number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      currency: invoice.currency,
      paymentTerms: invoice.payment_terms,
      orderDiscountPct: invoice.order_discount_pct,
      supplier: invoice.supplier_snapshot,
      customer: invoice.customer_snapshot,
      lines: invoice.lines_snapshot,
      netCents: invoice.net_cents,
      vatCents: invoice.vat_cents,
      grossCents: invoice.gross_cents,
    });
    if (!parsed.success) throw new InvoicingError("invalid_input");
    const provider = await createInvoicingProvider(
      invoice.provider as "mock" | "fic",
    );
    const result = await provider.createInvoice(parsed.data);
    const finished = await db.rpc("finish_invoice_issue", {
      p_id: id,
      p_lease: lease,
      p_external_id: result.externalId,
      p_status: result.status,
    });
    if (finished.error || !finished.data)
      throw new InvoicingError("unavailable", true);
    return id;
  } catch (error) {
    await db.rpc("fail_invoice_issue", {
      p_id: id,
      p_lease: lease,
      p_error:
        error instanceof InvoicingError && error.code === "invalid_input"
          ? "invalid_input"
          : "provider_unavailable",
    });
    throw error;
  }
}
