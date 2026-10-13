import { getTranslations } from "next-intl/server";
import { getSessionUser, requireBrandAccess } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getPortalSales } from "@/modules/portal/queries";
import { portalFiltersSchema } from "@/modules/portal/schema";
import { exportCsv } from "@/lib/csv";
import { centsToDecimal } from "@/lib/money";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "brand")
    return new Response(null, { status: 403, headers });
  const p = await getTranslations("portal"),
    filters = portalFiltersSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
  if (!filters.success)
    return new Response(p("invalidFilters"), { status: 400, headers });
  if (filters.data.brand_id) {
    try {
      await requireBrandAccess(filters.data.brand_id);
    } catch (error) {
      return new Response(null, {
        status:
          error instanceof AppError && error.code === "NOT_FOUND" ? 404 : 503,
        headers,
      });
    }
  }
  if (filters.data.season_id) {
    let scope = (await createClient())
      .from("seasons")
      .select("id")
      .eq("id", filters.data.season_id);
    if (filters.data.brand_id)
      scope = scope.eq("brand_id", filters.data.brand_id);
    const season = await scope.maybeSingle();
    if (season.error) return new Response(null, { status: 503, headers });
    if (!season.data) return new Response(null, { status: 404, headers });
  }
  const report = await getPortalSales(filters.data, 0, 10000);
  if (!report.ok) return new Response(p("loadError"), { status: 503, headers });
  if (report.data.count > 10000)
    return new Response(p("exportTooLarge"), { status: 413, headers });
  const csv = exportCsv(
    [
      p("brand"),
      p("season"),
      p("customer"),
      p("city"),
      p("ordersCount"),
      p("sold"),
    ],
    report.data.rows.map((row) => [
      row.brand_name,
      row.season_code,
      row.customer_display_name,
      row.customer_city,
      row.order_count,
      centsToDecimal(BigInt(row.net_cents)),
    ]),
  );
  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vendite-brand.csv"',
    },
  });
}
