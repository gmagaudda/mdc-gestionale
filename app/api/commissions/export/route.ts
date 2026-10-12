import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { commissionsFiltersSchema } from "@/modules/commissions/schema";
import { getCommissionsReport } from "@/modules/commissions/queries";
import { commissionSheets } from "@/modules/commissions/export";
import { exportXlsx } from "@/lib/xlsx";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "brand")
    return new Response(null, { status: 403, headers });
  const t = await getTranslations("commissions");
  const parsed = commissionsFiltersSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return new Response(t("invalidFilters"), { status: 400, headers });
  try {
    // One SQL snapshot: summary and complete order export cannot disagree because
    // an order changes between separate page requests.
    const report = await getCommissionsReport(parsed.data, 0, 10000);
    if (!report.ok)
      return new Response(t("loadError"), { status: 503, headers });
    if (report.data.order_count > 10000 || report.data.brand_count > 500)
      return new Response(t("tooLarge"), { status: 413, headers });
    const bytes = await exportXlsx(
      commissionSheets(report.data, t, parsed.data),
    );
    return new Response(bytes, {
      headers: {
        ...headers,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="provvigioni.xlsx"',
      },
    });
  } catch {
    return new Response(t("loadError"), { status: 503, headers });
  }
}
