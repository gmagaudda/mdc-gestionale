import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters } from "@/modules/dashboard/schema";
import { commissionsReportSchema } from "./schema";
export async function getCommissionsReport(
  filters: DashboardFilters,
  offset = 0,
  limit = 25,
  q = "",
) {
  const { data, error } = await (
    await createClient()
  ).rpc("commissions_report", {
    ...(filters.brand_id ? { p_brand_id: filters.brand_id } : {}),
    ...(filters.season_id ? { p_season_id: filters.season_id } : {}),
    ...(filters.from ? { p_start: filters.from } : {}),
    ...(filters.to ? { p_end: filters.to } : {}),
    p_offset: offset,
    p_limit: limit,
    p_q: q,
  });
  const parsed = commissionsReportSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
