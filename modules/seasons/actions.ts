"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { seasonSchema } from "./schema";
export async function saveSeason(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const db = await createClient();
  const data = {
    ...parsed.data,
    campaign_start: parsed.data.campaign_start || null,
    campaign_end: parsed.data.campaign_end || null,
    delivery_start: parsed.data.delivery_start || null,
    delivery_end: parsed.data.delivery_end || null,
  };
  const result = id
    ? await db
        .from("seasons")
        .update(data)
        .eq("id", id)
        .eq("brand_id", data.brand_id)
        .is("deleted_at", null)
        .select("id")
        .single()
    : await db.from("seasons").insert(data).select("id").single();
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "23505" ? "conflict" : "saveError",
    };
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${result.data.id}`);
  return { ok: true, data: result.data.id };
}
export async function archiveSeason(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  const db = await createClient();
  const { error } = await db
    .from("seasons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${id}`);
  return { ok: true, data: undefined };
}
