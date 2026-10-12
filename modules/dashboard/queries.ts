import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dashboardReportSchema, type DashboardFilters } from "./schema";
export async function getDashboardReport(filters: DashboardFilters) {
  const { data, error } = await (
    await createClient()
  ).rpc("dashboard_report", {
    ...(filters.brand_id ? { p_brand_id: filters.brand_id } : {}),
    ...(filters.season_id ? { p_season_id: filters.season_id } : {}),
    ...(filters.from ? { p_start: filters.from } : {}),
    ...(filters.to ? { p_end: filters.to } : {}),
  });
  const parsed = dashboardReportSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
