"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { productSchema } from "./schema";
export async function saveProduct(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const db = await createClient();
  const { data, error } = await db.rpc("save_product", {
    p_id: id as string,
    p_data: parsed.data,
  });
  if (error || !data)
    return {
      ok: false,
      error: error?.code === "23505" ? "conflict" : "saveError",
    };
  revalidatePath("/products");
  revalidatePath(`/products/${data}`);
  return { ok: true, data };
}
export async function archiveProduct(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  const db = await createClient();
  const { error } = await db
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, data: undefined };
}
