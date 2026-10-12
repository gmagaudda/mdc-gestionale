"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { matchKindSchema, matchChoiceSchema } from "./match-schema";
export async function resolveImportMatch(
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  const parsed = z
    .object({
      id: z.uuid(),
      revision: z.uuid(),
      kind: matchKindSchema,
      subject: z.array(z.string().max(200)).min(1).max(5),
      choice: matchChoiceSchema,
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const p = parsed.data,
    result = await (
      await createClient()
    ).rpc("resolve_import_match", {
      p_id: p.id,
      p_revision: p.revision,
      p_kind: p.kind,
      p_subject: p.subject,
      p_choice: p.choice,
    });
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "40001" ? "configConflict" : "matchError",
    };
  revalidatePath(`/imports/${p.id}`);
  return { ok: true, data: undefined };
}
export async function excludeImportErrors(
  id: string,
  rows: string[],
  revision: string,
): Promise<ActionResult> {
  await requireRole(["admin", "accounting"]);
  if (
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(revision).success ||
    !z.array(z.uuid()).min(1).max(500).safeParse(rows).success
  )
    return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("exclude_import_errors", {
    p_id: id,
    p_rows: rows,
    p_revision: revision,
  });
  if (result.error)
    return {
      ok: false,
      error: result.error.code === "40001" ? "configConflict" : "saveError",
    };
  revalidatePath(`/imports/${id}`);
  return { ok: true, data: undefined };
}
