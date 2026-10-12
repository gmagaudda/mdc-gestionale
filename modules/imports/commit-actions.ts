"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
export async function setImportExpected(
  id: string,
  revision: string,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  const parsed = z
    .record(z.string().min(1).max(200), z.string().regex(/^\d{1,17}$/))
    .safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(revision).success ||
    !parsed.success
  )
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("set_import_expected", {
    p_id: id,
    p_revision: revision,
    p_expected: parsed.data,
  });
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "40001" ? "configConflict" : "saveError",
    };
  revalidatePath(`/imports/${id}`);
  return { ok: true, data: undefined };
}
export async function commitOperationalImport(
  id: string,
  updates: boolean,
  differences: boolean,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (
    !z.uuid().safeParse(id).success ||
    typeof updates !== "boolean" ||
    typeof differences !== "boolean"
  )
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("import_commit", {
    p_id: id,
    p_confirm_updates: updates,
    p_confirm_differences: differences,
  });
  if (result.error)
    return {
      ok: false,
      error:
        result.error.message === "TOTAL_DIFFERENCES"
          ? "commitTotalDifferences"
          : result.error.code === "23514" || result.error.code === "23P01"
            ? "commitValidation"
            : "saveError",
    };
  for (const path of [
    "/imports",
    `/imports/${id}`,
    "/customers",
    "/orders",
    "/budgets",
    "/seasons",
    "/products",
    "/brands",
    "/dashboard",
  ])
    revalidatePath(path);
  return { ok: true, data: undefined };
}
export async function rollbackOperationalImport(
  id: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("import_rollback", { p_id: id });
  if (result.error)
    return {
      ok: false,
      error:
        result.error.code === "40001" || result.error.code === "23514"
          ? "rollbackUnavailable"
          : "saveError",
    };
  for (const path of [
    "/imports",
    `/imports/${id}`,
    "/customers",
    "/orders",
    "/budgets",
    "/seasons",
    "/products",
    "/brands",
    "/dashboard",
  ])
    revalidatePath(path);
  return { ok: true, data: undefined };
}
