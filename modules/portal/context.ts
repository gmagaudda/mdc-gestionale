import "server-only";
import { notFound } from "next/navigation";
import { requireRole, requireBrandAccess } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { portalFiltersSchema } from "./schema";
export async function getPortalContext(
  input: Record<string, string | string[] | undefined>,
) {
  await requireRole(["brand"]);
  const parsed = portalFiltersSchema.safeParse(input),
    filters = parsed.success ? parsed.data : portalFiltersSchema.parse({});
  if (filters.brand_id) {
    try {
      await requireBrandAccess(filters.brand_id);
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
      throw error;
    }
  }
  const db = await createClient();
  const [brands, seasons] = await Promise.all([
    db
      .from("brands")
      .select("id,name")
      .is("deleted_at", null)
      .order("name")
      .limit(501),
    db
      .from("seasons")
      .select("id,brand_id,code,name")
      .is("deleted_at", null)
      .order("code")
      .limit(501),
  ]);
  if (
    brands.error ||
    seasons.error ||
    (brands.data?.length ?? 0) > 500 ||
    (seasons.data?.length ?? 0) > 500
  )
    throw Error("Portal choices unavailable");
  if (
    filters.season_id &&
    !seasons.data.some(
      (s) =>
        s.id === filters.season_id &&
        (!filters.brand_id || s.brand_id === filters.brand_id),
    )
  )
    notFound();
  return { parsed, filters, brands: brands.data, seasons: seasons.data };
}
