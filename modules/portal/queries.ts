import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters } from "@/modules/dashboard/schema";
import { portalDashboardSchema } from "./schema";
import {
  portalOrdersSchema,
  portalSalesSchema,
  type portalOrderFiltersSchema,
} from "./schema";
import type { z } from "zod";
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
export async function getPortalOrders(
  filters: z.infer<typeof portalOrderFiltersSchema>,
  offset = 0,
  limit = 25,
) {
  const { data, error } = await (
    await createClient()
  ).rpc("portal_orders_report", {
    ...(filters.brand_id ? { p_brand_id: filters.brand_id } : {}),
    ...(filters.season_id ? { p_season_id: filters.season_id } : {}),
    ...(filters.from ? { p_start: filters.from } : {}),
    ...(filters.to ? { p_end: filters.to } : {}),
    ...(filters.status ? { p_status: filters.status } : {}),
    p_offset: offset,
    p_limit: limit,
  });
  const parsed = portalOrdersSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
export async function getPortalSales(
  filters: DashboardFilters,
  offset = 0,
  limit = 25,
) {
  const { data, error } = await (
    await createClient()
  ).rpc("portal_sales_report", {
    ...(filters.brand_id ? { p_brand_id: filters.brand_id } : {}),
    ...(filters.season_id ? { p_season_id: filters.season_id } : {}),
    ...(filters.from ? { p_start: filters.from } : {}),
    ...(filters.to ? { p_end: filters.to } : {}),
    p_offset: offset,
    p_limit: limit,
  });
  const parsed = portalSalesSchema.safeParse(data);
  return error || !parsed.success
    ? { ok: false as const }
    : { ok: true as const, data: parsed.data };
}
