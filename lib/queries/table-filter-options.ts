"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { listExportEntitySchema } from "@/lib/exports/lists";
import { columnFilters } from "./column-filters";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/errors";
import type { Choice } from "@/components/shared/search-select";
export async function tableFilterOptions(
  entity: unknown,
  column: unknown,
  term: unknown,
): Promise<ActionResult<Choice[]>> {
  await requireRole(internalRoles);
  const parsed = z
    .object({
      entity: listExportEntitySchema,
      column: z.string(),
      term: z.string().trim().max(100),
    })
    .safeParse({ entity, column, term });
  if (!parsed.success) return { ok: false, error: "VALIDATION" };
  const field = columnFilters[parsed.data.entity].find(
    (item) => item.key === parsed.data.column && item.kind !== "date",
  );
  if (!field) return { ok: false, error: "VALIDATION" };
  const { data, error } = await (
    await createClient()
  ).rpc("table_filter_options", {
    p_entity: parsed.data.entity,
    p_column: field.key,
    p_q: parsed.data.term,
  });
  const values = z.array(z.string()).max(50).safeParse(data);
  if (error || !values.success) return { ok: false, error: "UNAVAILABLE" };
  return {
    ok: true,
    data: values.data.map((value) =>
      field.kind === "money"
        ? {
            value: `${BigInt(value) / 100n},${String(BigInt(value) % 100n).padStart(2, "0")}`,
            label: formatMoney(BigInt(value)),
          }
        : { value, label: value },
    ),
  };
}
