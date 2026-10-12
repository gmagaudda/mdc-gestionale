"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  invoicingProviderName,
  createInvoicingProvider,
} from "@/lib/invoicing";
import { InvoicingError } from "@/lib/invoicing/types";
import type { ActionResult } from "@/lib/errors";
import { generateInvoiceSchema, paymentSchema } from "./schema";
import { issueInvoice } from "./service";
function refresh(id: string, orderId?: string | null) {
  for (const path of [
    "/invoices",
    `/invoices/${id}`,
    "/dashboard",
    "/orders",
    ...(orderId ? [`/orders/${orderId}`] : []),
  ])
    revalidatePath(path);
}
function errorKey(code: string) {
  return code === "23514" || code === "22023"
    ? "validation"
    : code === "23505"
      ? "conflict"
      : code === "55P03"
        ? "processing"
        : "saveError";
}
export async function generateInvoice(
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "accounting"]);
  const parsed = generateInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    const result = await (
      await createClient()
    ).rpc("reserve_invoice_from_order", {
      p_order_id: parsed.data.orderId,
      p_issue_date: parsed.data.issueDate,
      p_due_date: parsed.data.dueDate,
      p_provider: invoicingProviderName(),
    });
    if (result.error || !result.data)
      return { ok: false, error: errorKey(result.error?.code ?? "") };
    try {
      await issueInvoice(result.data);
    } catch (error) {
      refresh(result.data, parsed.data.orderId);
      if (error instanceof InvoicingError && error.code === "conflict")
        return { ok: false, error: "processing" };
      return { ok: true, data: result.data };
    }
    refresh(result.data, parsed.data.orderId);
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: "saveError" };
  }
}
export async function retryInvoice(id: string): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  try {
    await issueInvoice(id);
    refresh(id);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvoicingError && error.code === "conflict"
          ? "processing"
          : "saveError",
    };
  }
}
export async function registerPayment(input: unknown): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const value = parsed.data;
  const result = await (
    await createClient()
  ).rpc("register_invoice_payment", {
    p_id: value.invoiceId,
    p_key: value.idempotencyKey,
    p_amount: value.amount,
    p_paid_at: `${value.paidDate}T12:00:00Z`,
    p_method: value.method,
    p_note: value.note,
  });
  if (result.error) return { ok: false, error: errorKey(result.error.code) };
  refresh(value.invoiceId);
  return { ok: true, data: undefined };
}
export async function reconcileInvoice(id: string): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const db = await createClient();
  const { data, error } = await db
    .from("invoices")
    .select("external_id,provider,order_id")
    .eq("id", id)
    .single();
  if (error || !data?.external_id) return { ok: false, error: "saveError" };
  try {
    const provider = await createInvoicingProvider(
      data.provider as "mock" | "fic",
    );
    const status = await provider.getStatus(data.external_id);
    const result = await db.rpc("reconcile_invoice_status", {
      p_id: id,
      p_external_id: data.external_id,
      p_status: status,
    });
    if (result.error) return { ok: false, error: errorKey(result.error.code) };
    refresh(id, data.order_id);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "saveError" };
  }
}
export async function cancelInvoice(id: string): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const db = await createClient();
  const claim = await db.rpc("claim_invoice_cancellation", { p_id: id });
  if (claim.error) return { ok: false, error: errorKey(claim.error.code) };
  if (!claim.data) {
    refresh(id);
    return { ok: true, data: undefined };
  }
  try {
    const { data, error } = await db
      .from("invoices")
      .select("external_id,provider,order_id")
      .eq("id", id)
      .single();
    if (error || !data?.external_id)
      throw new InvoicingError("unavailable", true);
    const provider = await createInvoicingProvider(
      data.provider as "mock" | "fic",
    );
    await provider.cancelInvoice(data.external_id);
    const result = await db.rpc("finish_invoice_cancellation", {
      p_id: id,
      p_lease: claim.data,
    });
    if (result.error || !result.data)
      throw new InvoicingError("unavailable", true);
    refresh(id, data.order_id);
    return { ok: true, data: undefined };
  } catch {
    await db.rpc("fail_invoice_issue", {
      p_id: id,
      p_lease: claim.data,
      p_error: "provider_unavailable",
    });
    refresh(id);
    return { ok: false, error: "saveError" };
  }
}
