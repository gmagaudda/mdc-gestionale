"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { mappingProfileSchema } from "./fields";
import { normalizeMappedSheet } from "./validation";
const rawRowSchema = z
  .object({
    number: z.number().int().min(1).max(1048576),
    values: z
      .array(
        z.union([
          z.string().max(10000),
          z.number().finite(),
          z.boolean(),
          z.null(),
          z.object({ error: z.string().max(100) }).strict(),
        ]),
      )
      .max(128),
  })
  .strict();
export async function saveMappingProfile(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  const user = await requireRole(["admin", "accounting"]),
    parsed = mappingProfileSchema.safeParse(input);
  if (
    !parsed.success ||
    (id !== null && !z.uuid().safeParse(id).success) ||
    (user.role === "accounting" && parsed.data.entity !== "budgets")
  )
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("save_import_profile", { p_id: id as string, p_data: parsed.data });
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath("/imports/operational");
  return { ok: true, data: result.data };
}
export async function configureOperationalBatch(
  id: string,
  input: unknown,
): Promise<ActionResult<string>> {
  const user = await requireRole(["admin", "accounting"]),
    parsed = z
      .object({
        profiles: z.array(mappingProfileSchema).min(1).max(20),
        expected: z
          .record(z.string().min(1).max(200), z.string().regex(/^\d{1,17}$/))
          .default({}),
      })
      .strict()
      .safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return { ok: false, error: "validation" };
  if (
    user.role === "accounting" &&
    parsed.data.profiles.some(
      (p) => p.entity !== "budgets" || p.options.allowCreateSeasons,
    )
  )
    return { ok: false, error: "validation" };
  if (
    new Set(parsed.data.profiles.map((p) => p.sheet_name)).size !==
    parsed.data.profiles.length
  )
    return { ok: false, error: "validation" };
  const db = await createClient(),
    previous = await db
      .from("import_batches")
      .select("options,created_by")
      .eq("id", id)
      .maybeSingle();
  if (previous.error || !previous.data || previous.data.created_by !== user.id)
    return { ok: false, error: "validation" };
  const old = z
    .object({ revision: z.uuid(), profiles: z.array(mappingProfileSchema) })
    .safeParse(previous.data.options);
  const revision =
    old.success &&
    JSON.stringify(old.data.profiles) === JSON.stringify(parsed.data.profiles)
      ? old.data.revision
      : crypto.randomUUID();
  const options = { profiles: parsed.data.profiles, revision };
  if (new TextEncoder().encode(JSON.stringify(options)).length > 32768)
    return { ok: false, error: "validation" };
  const result = await db.rpc("configure_import_batch", {
    p_id: id,
    p_options: options,
    p_expected: parsed.data.expected,
    p_previous_revision: (old.success ? old.data.revision : null) as string,
  });
  return result.error
    ? {
        ok: false,
        error: result.error.code === "40001" ? "configConflict" : "saveError",
      }
    : { ok: true, data: revision };
}
export async function stageOperationalRows(
  id: string,
  sheet: string,
  revision: string,
  input: unknown,
): Promise<ActionResult<number>> {
  const user = await requireRole(["admin", "accounting"]),
    parsed = z.array(rawRowSchema).min(1).max(500).safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(revision).success ||
    !z.string().min(1).max(100).safeParse(sheet).success ||
    !parsed.success
  )
    return { ok: false, error: "validation" };
  const db = await createClient(),
    batch = await db
      .from("import_batches")
      .select("options,kind")
      .eq("id", id)
      .eq("created_by", user.id)
      .maybeSingle();
  if (batch.error || !batch.data || batch.data.kind === "performance")
    return { ok: false, error: "validation" };
  const options = z
    .object({
      profiles: z.array(mappingProfileSchema).min(1).max(20),
      revision: z.uuid(),
    })
    .safeParse(batch.data.options);
  if (!options.success || options.data.revision !== revision)
    return { ok: false, error: "configConflict" };
  const profile = options.success
    ? options.data.profiles.find((p) => p.sheet_name === sheet)
    : undefined;
  if (!profile || (user.role === "accounting" && profile.entity !== "budgets"))
    return { ok: false, error: "validation" };
  const rows = normalizeMappedSheet(
    { name: sheet, rows: parsed.data },
    profile,
  ).map((row) => ({
    ...row,
    messages: row.messages.map((message) => ({ ...message })),
  }));
  if (
    rows.some(
      (row) =>
        new TextEncoder().encode(JSON.stringify(row.raw)).length > 32768 ||
        new TextEncoder().encode(JSON.stringify(row.mapped)).length > 32768,
    )
  )
    return { ok: false, error: "rowSize" };
  const result = await db.rpc("stage_import_rows", {
    p_id: id,
    p_rows: rows,
    p_revision: revision,
  });
  return result.error
    ? {
        ok: false,
        error: result.error.code === "40001" ? "configConflict" : "saveError",
      }
    : { ok: true, data: result.data };
}
export async function finishOperationalStaging(
  id: string,
  revision: string,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  const counts = z
    .record(z.string().min(1).max(100), z.number().int().min(0).max(20000))
    .safeParse(input);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(revision).success ||
    !counts.success
  )
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("finish_import_staging", {
    p_id: id,
    p_revision: revision,
    p_counts: counts.data,
  });
  return result.error
    ? {
        ok: false,
        error: result.error.code === "40001" ? "configConflict" : "saveError",
      }
    : { ok: true, data: undefined };
}
