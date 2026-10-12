"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { orderSchema, statusSchema } from "./schema";
import { canTransition } from "./domain";
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
