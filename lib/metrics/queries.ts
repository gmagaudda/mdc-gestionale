import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { listExportEntitySchema } from "@/lib/exports/lists";
import { parseColumnFilters } from "@/lib/queries/column-filters";
import { metricEntitySchema, metricsSchema } from "./schema";
const id = z.uuid().or(z.literal(""));
const filtersSchema = z
  .object({
    brand_id: id.optional(),
    customer_id: id.optional(),
    season_id: id.optional(),
    status: z
      .enum([
        "",
        "all",
        "draft",
        "confirmed",
        "in_production",
        "shipped",
        "delivered",
        "invoiced",
        "cancelled",
        "issued",
        "sent",
        "paid",
        "rejected",
      ])
      .optional(),
    overdue: z.enum(["", "all", "yes"]).optional(),
  })
  .strict();
export async function getTableMetrics(
  base: string,
  q: string,
  filters: Record<string, string>,
  columnFilters?: Record<string, unknown>,
) {
  const entity = metricEntitySchema.safeParse(base.replace(/^\//, ""));
  const parsedQ = z.string().trim().max(100).safeParse(q);
  // Date filters have been removed from the table interface.
  const parsedFilters = filtersSchema.safeParse(
    Object.fromEntries(
      Object.entries(filters).filter(
        ([key, value]) => value && key !== "from" && key !== "to",
      ),
    ),
  );
  const exportEntity = listExportEntitySchema.safeParse(
    entity.success ? entity.data : "",
  );
  const columns = exportEntity.success
    ? parseColumnFilters(columnFilters, exportEntity.data)
    : { ok: true as const, data: {} };
  if (
    !entity.success ||
    !parsedQ.success ||
    !parsedFilters.success ||
    !columns.ok
  )
    return { ok: false as const };
  const { data, error } = await (
    await createClient()
  ).rpc("table_metrics", {
    p_entity: entity.data,
    p_q: parsedQ.data,
    p_filters: parsedFilters.data,
    p_columns: columns.data,
  });
  const parsed = metricsSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
