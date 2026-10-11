"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { userSchema } from "./schema";
export async function saveUser(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = userSchema.safeParse(input);
  if (!parsed.success || !uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const client = await createClient();
  const { error } = await client.rpc("save_user", {
    p_id: id,
    p_full_name: parsed.data.full_name,
    p_role: parsed.data.role,
    p_is_active: parsed.data.is_active,
    p_brand_ids: parsed.data.brand_ids,
  });
  if (error)
    return {
      ok: false,
      error: error.message === "LAST_ADMIN" ? "lastAdmin" : "saveError",
    };
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${id}`);
  return { ok: true, data: undefined };
}
