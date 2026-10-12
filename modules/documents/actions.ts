"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { documentSchema } from "./schema";
import { escapeLike } from "@/lib/queries/list";
export async function searchDocumentOrders(brandId: string, query: string) {
  await requireRole(["admin", "staff"]);
  if (
    !z.uuid().safeParse(brandId).success ||
    !z.string().max(100).safeParse(query).success
  )
    return { ok: false as const, error: "validation" };
  const result = await (
    await createClient()
  )
    .from("orders")
    .select("id,number,customer_id,customers(legal_name)")
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .ilike("number", `%${escapeLike(query.trim())}%`)
    .order("number", { ascending: false })
    .limit(20);
  if (result.error) return { ok: false as const, error: "loadError" };
  return {
    ok: true as const,
    data: result.data.map((row) => ({
      value: row.id,
      label: `${row.number} · ${row.customers?.legal_name ?? ""}`,
    })),
  };
}
export async function updateDocument(
  id: string,
  input: unknown,
  updatedAt: string,
): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  const value = documentSchema.omit({ brand_id: true }).safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.iso.datetime({ offset: true }).safeParse(updatedAt).success ||
    !value.success
  )
    return { ok: false, error: "validation" };
  const data = value.data,
    result = await (
      await createClient()
    )
      .from("documents")
      .update({
        ...data,
        customer_id: data.customer_id || null,
        order_id: data.order_id || null,
      })
      .eq("id", id)
      .eq("updated_at", updatedAt)
      .eq("ready", true)
      .is("deleted_at", null)
      .select("id")
      .single();
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "PGRST116" ? "conflict" : "saveError",
    };
  revalidatePath("/documents");
  revalidatePath("/portal/documents");
  return { ok: true, data: undefined };
}
export async function archiveDocument(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  )
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("ready", true)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath("/documents");
  revalidatePath("/portal/documents");
  return { ok: true, data: undefined };
}
