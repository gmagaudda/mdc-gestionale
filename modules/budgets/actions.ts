"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { escapeLike } from "@/lib/queries/list";
import type { ActionResult } from "@/lib/errors";
import type { Choice } from "@/components/shared/search-select";
import { budgetSchema } from "./schema";
import { recommendationSettingsSchema } from "./recommendation-schema";
export async function searchBudgetBrands(
  input: unknown,
): Promise<ActionResult<Choice[]>> {
  await requireRole(internalRoles);
  const term = z.string().trim().max(100).safeParse(input);
  if (!term.success) return { ok: false, error: "validation" };
  const { data, error } = await (
    await createClient()
  )
    .from("brands")
    .select("id,name")
    .is("deleted_at", null)
    .ilike("name", `%${escapeLike(term.data)}%`)
    .order("name")
    .limit(50);
  return error
    ? { ok: false, error: "loadError" }
    : {
        ok: true,
        data: data.map((row) => ({ value: row.id, label: row.name })),
      };
}
export async function searchBudgetSeasons(
  brandId: string,
  input: unknown,
): Promise<ActionResult<Choice[]>> {
  await requireRole(internalRoles);
  const term = z.string().trim().max(100).safeParse(input);
  if (!z.uuid().safeParse(brandId).success || !term.success)
    return { ok: false, error: "validation" };
  const { data, error } = await (
    await createClient()
  )
    .from("seasons")
    .select("id,name,code")
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .ilike("name", `%${escapeLike(term.data)}%`)
    .order("name")
    .limit(50);
  return error
    ? { ok: false, error: "loadError" }
    : {
        ok: true,
        data: data.map((row) => ({
          value: row.id,
          label: `${row.code} · ${row.name}`,
        })),
      };
}
export async function saveBudget(
  id: string | null,
  input: unknown,
  updatedAt: string | null = null,
  recommendation?: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "accounting"]);
  const parsed = budgetSchema.safeParse(input);
  if (
    !parsed.success ||
    (id !== null &&
      (!z.uuid().safeParse(id).success ||
        !z.iso.datetime({ offset: true }).safeParse(updatedAt).success))
  )
    return { ok: false, error: "validation" };
  const provenance = z
    .object({
      settings: recommendationSettingsSchema,
      expected: z.string().regex(/^[a-f0-9]{32}$/),
      adjustment_reason: z.string().trim().max(500),
    })
    .strict()
    .safeParse(recommendation);
  if (recommendation !== undefined && (id !== null || !provenance.success))
    return { ok: false, error: "validation" };
  const db = await createClient();
  const { data, error } = provenance.success
    ? await db.rpc("apply_budget_recommendation", {
        p_data: parsed.data,
        p_settings: provenance.data.settings,
        p_expected: provenance.data.expected,
        p_adjustment_reason: provenance.data.adjustment_reason,
      })
    : await db.rpc("save_budget", {
        p_id: id as string,
        p_data: parsed.data,
        ...(updatedAt ? { p_updated_at: updatedAt } : {}),
      });
  if (error || !data)
    return {
      ok: false,
      error:
        error?.code === "40001"
          ? "recommendationStale"
          : error?.message === "REASON_REQUIRED"
            ? "adjustmentRequired"
            : error?.code === "23P01"
              ? "overlap"
              : error?.code === "P0002"
                ? "conflict"
                : error?.code === "23514" || error?.code === "23503"
                  ? "validation"
                  : "saveError",
    };
  revalidatePath("/budgets");
  revalidatePath(`/budgets/${data}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal/dashboard");
  return { ok: true, data };
}
export async function archiveBudget(id: string): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const { error } = await (
    await createClient()
  )
    .from("budgets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath("/budgets");
  revalidatePath(`/budgets/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/portal/dashboard");
  return { ok: true, data: undefined };
}
