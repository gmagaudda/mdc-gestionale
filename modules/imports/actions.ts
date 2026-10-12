"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import type { Json } from "@/lib/supabase/types";
import { performanceRowSchema, performanceMetrics } from "./performance";
const expectedSchema = z
  .object(
    Object.fromEntries(
      performanceMetrics.map((m) => [
        m.key,
        z.number().int().min(0).max(1000000000000).nullable(),
      ]),
    ),
  )
  .strict();
export async function configurePerformanceBatch(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  const parsed = z
    .object({
      sheet: z.string().min(1).max(100),
      pivotBrands: z.array(z.string().min(1).max(200)).max(500),
      expected: expectedSchema,
    })
    .strict()
    .safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("configure_import_batch", {
    p_id: id,
    p_options: {
      sheet: parsed.data.sheet,
      pivotBrands: parsed.data.pivotBrands,
    },
    p_expected: parsed.data.expected,
  });
  return result.error
    ? { ok: false, error: "saveError" }
    : { ok: true, data: undefined };
}
export async function stagePerformanceRows(
  id: string,
  sheet: string,
  input: unknown,
): Promise<ActionResult<number>> {
  await requireRole(["admin"]);
  const parsed = z.array(performanceRowSchema).min(1).max(500).safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.string().min(1).max(100).safeParse(sheet).success ||
    !parsed.success
  )
    return { ok: false, error: "validation" };
  const rows = parsed.data.map((row) => ({
    entity: "performance",
    sheet,
    row_number: row.row_number,
    raw: row,
    mapped: row,
    status: row.customer ? "valid" : "warning",
    messages: row.customer ? [] : [{ code: "missingCustomer" }],
  }));
  const result = await (
    await createClient()
  ).rpc("stage_import_rows", { p_id: id, p_rows: rows as Json });
  return result.error
    ? { ok: false, error: "saveError" }
    : { ok: true, data: result.data };
}
export async function completePerformanceBatch(
  id: string,
  confirmed = false,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!z.uuid().safeParse(id).success || typeof confirmed !== "boolean")
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("complete_performance_import", {
    p_id: id,
    p_confirm_differences: confirmed,
  });
  if (result.error)
    return {
      ok: false,
      error: result.error.message.includes("TOTAL_DIFFERENCES")
        ? "totalDifferences"
        : "saveError",
    };
  revalidatePath("/analysis");
  revalidatePath("/imports");
  return { ok: true, data: undefined };
}
export async function rollbackPerformanceBatch(
  id: string,
): Promise<ActionResult> {
  await requireRole(["admin"]);
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("rollback_performance_import", { p_id: id });
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath("/analysis");
  revalidatePath("/imports");
  return { ok: true, data: undefined };
}
