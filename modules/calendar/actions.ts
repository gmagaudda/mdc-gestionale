"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { romeToUtc } from "@/lib/dates/rome";
import type { ActionResult } from "@/lib/errors";
import { eventSchema, moveEventSchema } from "./schema";
export async function saveEvent(
  id: string | null,
  input: unknown,
  updatedAt?: string,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  const parsed = eventSchema.safeParse(input);
  if (
    !parsed.success ||
    (id !== null &&
      (!z.uuid().safeParse(id).success ||
        !z.iso.datetime({ offset: true }).safeParse(updatedAt).success))
  )
    return { ok: false, error: "validation" };
  const db = await createClient();
  const value = parsed.data;
  const data = {
    ...value,
    starts_at: romeToUtc(value.starts_at),
    ends_at: romeToUtc(value.ends_at),
    brand_id: value.brand_id || null,
    customer_id: value.customer_id || null,
    assigned_to: value.assigned_to || null,
  };
  const result = id
    ? await db
        .from("events")
        .update(data)
        .eq("id", id)
        .eq("updated_at", updatedAt!)
        .is("deleted_at", null)
        .select("id")
        .single()
    : await db.from("events").insert(data).select("id").single();
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "PGRST116" ? "conflict" : "saveError",
    };
  revalidatePath("/calendar");
  revalidatePath("/portal/calendar");
  return { ok: true, data: result.data.id };
}
export async function moveEvent(input: unknown): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  const parsed = moveEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const db = await createClient();
  const { id, updated_at, ...data } = parsed.data;
  const result = await db
    .from("events")
    .update(data)
    .eq("id", id)
    .eq("updated_at", updated_at)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "PGRST116" ? "conflict" : "saveError",
    };
  revalidatePath("/calendar");
  revalidatePath("/portal/calendar");
  return { ok: true, data: undefined };
}
export async function archiveEvent(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const db = await createClient();
  const result = await db
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath("/calendar");
  revalidatePath("/portal/calendar");
  return { ok: true, data: undefined };
}
