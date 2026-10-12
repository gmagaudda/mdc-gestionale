import { getSessionUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { performanceFilterSchema } from "@/modules/imports/report-schema";
import { getPerformanceReport } from "@/modules/imports/queries";
import { performanceSheets } from "@/modules/imports/export";
import { exportXlsx } from "@/lib/xlsx";
import { exportCsv } from "@/lib/csv";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  if ((await getSessionUser())?.role !== "admin")
    return new Response(null, { status: 403, headers });
  const params = new URL(request.url).searchParams,
    format = params.get("format") ?? "xlsx",
    t = await getTranslations("imports");
  const parsed = performanceFilterSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success || !["xlsx", "csv"].includes(format))
    return new Response(t("invalidFilters"), { status: 400, headers });
  try {
    const report = await getPerformanceReport(parsed.data, true);
    if (!report.ok)
      return new Response(t("loadError"), { status: 503, headers });
    if (report.data.group_count > 5000)
      return new Response(t("exportLimit"), { status: 413, headers });
    const sheets = performanceSheets(report.data, parsed.data, t);
    return new Response(
      format === "csv"
        ? exportCsv(sheets[1].fields, sheets[1].rows)
        : await exportXlsx(sheets),
      {
        headers: {
          ...headers,
          "Content-Type":
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="analisi-stagioni.${format}"`,
        },
      },
    );
  } catch {
    return new Response(t("exportError"), { status: 503, headers });
  }
}
