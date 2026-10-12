import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  performanceReportSchema,
  type PerformanceFilters,
} from "./report-schema";
import { z } from "zod";
export async function getPerformanceReport(
  filters: PerformanceFilters,
  allGroups = false,
) {
  const db = await createClient();
  const batch = await db
    .from("import_batches")
    .select("options")
    .eq("id", filters.batch)
    .eq("status", "completed")
    .eq("kind", "performance")
    .maybeSingle();
  if (batch.error || !batch.data) return { ok: false as const };
  const options = z
    .object({ pivotBrands: z.array(z.string()).max(500) })
    .safeParse(batch.data.options);
  if (!options.success) return { ok: false as const };
  const brands = filters.brand
    ? [filters.brand]
    : filters.scope === "pivot" && options.data.pivotBrands.length
      ? options.data.pivotBrands
      : undefined;
  const result = await db.rpc("performance_report", {
    p_id: filters.batch,
    p_dimension: filters.dimension,
    p_filters: {
      ...(brands ? { brands } : {}),
      area: filters.area,
      representative: filters.representative,
      country: filters.country,
      region: filters.region,
      search: filters.search,
      page: allGroups ? 0 : filters.page,
    },
  });
  const parsed = performanceReportSchema.safeParse(result.data);
  return result.error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
