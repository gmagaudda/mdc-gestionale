import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters } from "@/modules/dashboard/schema";
import { portalDashboardSchema } from "./schema";
export async function getPortalDashboard(filters: DashboardFilters) {
  const { data, error } = await (
    await createClient()
  ).rpc("portal_dashboard_report", {
    ...(filters.brand_id ? { p_brand_id: filters.brand_id } : {}),
    ...(filters.season_id ? { p_season_id: filters.season_id } : {}),
    ...(filters.from ? { p_start: filters.from } : {}),
    ...(filters.to ? { p_end: filters.to } : {}),
  });
  const parsed = portalDashboardSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
