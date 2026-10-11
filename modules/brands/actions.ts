"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireBrandAccess, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { brandSchema, contactSchema } from "./schema";

export async function saveBrand(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin"]);
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const client = await createClient();
  const { data, error } = await client.rpc("save_brand", {
    p_id: id as string,
    p_data: parsed.data,
  });
  if (error || !data)
    return {
      ok: false,
      error: error?.code === "23505" ? "conflict" : "saveError",
    };
  // Both table writes and audit triggers execute inside save_brand's transaction.
  revalidatePath("/brands");
  revalidatePath(`/brands/${data}`);
  return { ok: true, data };
}
export async function archiveBrand(id: string): Promise<ActionResult> {
  await requireRole(["admin"]);
  await requireBrandAccess(id);
  const client = await createClient();
  const { error, count } = await client
    .from("brands")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error || count !== 1) return { ok: false, error: "saveError" };
  revalidatePath("/brands");
  revalidatePath(`/brands/${id}`);
  return { ok: true, data: undefined };
}
export async function saveContact(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  await requireBrandAccess(parsed.data.brand_id);
  const client = await createClient();
  const result = id
    ? await client
        .from("brand_contacts")
        .update(parsed.data)
        .eq("id", id)
        .eq("brand_id", parsed.data.brand_id)
        .is("deleted_at", null)
        .select("id")
        .single()
    : await client
        .from("brand_contacts")
        .insert(parsed.data)
        .select("id")
        .single();
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath(`/brands/${parsed.data.brand_id}`);
  return { ok: true, data: undefined };
}
export async function archiveContact(
  id: string,
  brandId: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  await requireBrandAccess(brandId);
  const client = await createClient();
  const { error } = await client
    .from("brand_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("brand_id", brandId)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath(`/brands/${brandId}`);
  return { ok: true, data: undefined };
}
