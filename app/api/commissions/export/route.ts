import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { commissionsFiltersSchema } from "@/modules/commissions/schema";
import { getCommissionsReport } from "@/modules/commissions/queries";
import { commissionSheets } from "@/modules/commissions/export";
import { exportXlsx } from "@/lib/xlsx";
import { z } from "zod";
import { exportCsv } from "@/lib/csv";
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
  const q = z
    .string()
    .trim()
    .max(100)
    .safeParse(new URL(request.url).searchParams.get("q") ?? "");
  const format = z
    .enum(["xlsx", "csv"])
    .safeParse(new URL(request.url).searchParams.get("format") ?? "xlsx");
  if (!parsed.success || !format.success || !q.success)
    return new Response(t("invalidFilters"), { status: 400, headers });
  try {
    // One SQL snapshot: summary and complete order export cannot disagree because
    // an order changes between separate page requests.
    const report = await getCommissionsReport(parsed.data, 0, 10000, q.data);
    if (!report.ok)
      return new Response(t("loadError"), { status: 503, headers });
    if (report.data.order_count > 10000 || report.data.brand_count > 500)
      return new Response(t("tooLarge"), { status: 413, headers });
    const sheets = commissionSheets(report.data, t, parsed.data);
    if (format.data === "csv")
      return new Response(exportCsv(sheets[2].fields, sheets[2].rows), {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="provvigioni.csv"',
        },
      });
    const bytes = await exportXlsx(sheets);
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
