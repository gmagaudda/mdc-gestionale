"use server";
import { uuid, string } from "zod";
import { escapeLike } from "@/lib/queries/list";
import type { Choice } from "@/components/shared/search-select";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { orderSchema, statusSchema } from "./schema";
import { canTransition } from "./domain";
export async function searchOrderCustomers(
  input: unknown,
): Promise<ActionResult<Choice[]>> {
  await requireRole(internalRoles);
  const parsed = string().trim().max(100).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const db = await createClient();
  let query = db
    .from("customers")
    .select("id,legal_name,city")
    .is("deleted_at", null)
    .order("legal_name")
    .limit(50);
  if (parsed.data)
    query = query.ilike("legal_name", `%${escapeLike(parsed.data)}%`);
  const { data, error } = await query;
  if (error) return { ok: false, error: "loadError" };
  return {
    ok: true,
    data: data.map((row) => ({
      value: row.id,
      label: `${row.legal_name}${row.city ? ` · ${row.city}` : ""}`,
    })),
  };
}
export async function saveOrder(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const db = await createClient();
  const { data, error } = await db.rpc("save_order", {
    p_id: id as string,
    p_data: parsed.data.header,
    p_lines: parsed.data.lines,
  });
  if (error || !data)
    return {
      ok: false,
      error:
        error?.code === "P0002"
          ? "draftUnavailable"
          : error?.code === "23514" || error?.code === "22003"
            ? "validation"
            : "saveError",
    };
  revalidatePath("/orders");
  revalidatePath(`/orders/${data}`);
  return { ok: true, data };
}
export async function changeOrderStatus(input: unknown): Promise<ActionResult> {
  const user = await requireRole(internalRoles);
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const db = await createClient();
  const current = await db
    .from("orders")
    .select("status")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .single();
  if (!current.data) return { ok: false, error: "notFound" };
  if (!canTransition(current.data.status, parsed.data.status, user.role))
    return { ok: false, error: "invalidTransition" };
  const { error } = await db.rpc("change_order_status", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error)
    return {
      ok: false,
      error: error.code === "23514" ? "invalidTransition" : "saveError",
    };
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.id}`);
  return { ok: true, data: undefined };
}

export async function duplicateOrder(
  id: string,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  const db = await createClient();
  const { data, error } = await db.rpc("duplicate_order", { p_id: id });
  if (error || !data)
    return {
      ok: false,
      error: error?.code === "23514" ? "duplicateUnavailable" : "saveError",
    };
  revalidatePath("/orders");
  return { ok: true, data };
}

export async function archiveOrder(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  const db = await createClient();
  const result = await db
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .in("status", ["draft", "cancelled"])
    .select("id")
    .single();
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath("/orders");
  return { ok: true, data: undefined };
}
