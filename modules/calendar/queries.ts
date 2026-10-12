import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { eventRangeSchema } from "./schema";
import type { Database } from "@/lib/supabase/types";
export type CalendarEvent = Database["public"]["Tables"]["events"]["Row"] & {
  customer_name?: string;
  brand_name?: string;
};
export async function calendarChoices() {
  const db = await createClient();
  const [brands, customers, assignees] = await Promise.all([
    db.from("brands").select("id,name").is("deleted_at", null).order("name"),
    db
      .from("customers")
      .select("id,legal_name,city")
      .is("deleted_at", null)
      .order("legal_name")
      .limit(50),
    db.rpc("calendar_assignees"),
  ]);
  if (brands.error || customers.error || assignees.error)
    throw Error("Calendar choices unavailable");
  return {
    brands: brands.data,
    customers: customers.data,
    assignees: assignees.data,
  };
}
export async function listEvents(input: unknown) {
  const parsed = eventRangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, status: 400 };
  const db = await createClient();
  const filters = parsed.data;
  let query = db
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .lt("starts_at", filters.end)
    .gt("ends_at", filters.start)
    .order("starts_at")
    .order("id")
    .limit(501);
  for (const key of ["brand_id", "customer_id", "assigned_to"] as const)
    if (filters[key]) query = query.eq(key, filters[key]);
  if (filters.type) query = query.eq("type", filters.type);
  const result = await query;
  if (result.error) return { ok: false as const, status: 503 };
  if (result.data.length > 500) return { ok: false as const, status: 413 };
  const user = await getSessionUser();
  if (user?.role !== "brand") {
    const ids = [
      ...new Set(
        result.data.flatMap((r) => (r.customer_id ? [r.customer_id] : [])),
      ),
    ];
    const customers = ids.length
      ? await db.from("customers").select("id,legal_name").in("id", ids)
      : { data: [], error: null };
    const brandIds = [
      ...new Set(result.data.flatMap((r) => (r.brand_id ? [r.brand_id] : []))),
    ];
    const brands = brandIds.length
      ? await db.from("brands").select("id,name").in("id", brandIds)
      : { data: [], error: null };
    if (customers.error || brands.error)
      return { ok: false as const, status: 503 };
    return {
      ok: true as const,
      data: result.data.map((r) => ({
        ...r,
        customer_name: customers.data?.find((c) => c.id === r.customer_id)
          ?.legal_name,
        brand_name: brands.data?.find((b) => b.id === r.brand_id)?.name,
      })),
    };
  }
  return { ok: true as const, data: result.data };
}
