import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  finalReportSchema,
  finalReportSheets,
} from "@/modules/imports/final-report";
import { exportXlsx } from "@/lib/xlsx";
import { exportCsv } from "@/lib/csv";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role))
    return new Response(null, { status: 403, headers });
  const { id } = await params,
    format = new URL(request.url).searchParams.get("format") ?? "xlsx",
    t = await getTranslations("imports");
  if (!z.uuid().safeParse(id).success || !["xlsx", "csv"].includes(format))
    return new Response(t("invalidFilters"), { status: 400, headers });
  try {
    const db = await createClient(),
      batch = await db
        .from("import_batches")
        .select("id")
        .eq("id", id)
        .maybeSingle();
    if (!batch.data) return new Response(null, { status: 404, headers });
    const result = await db.rpc("import_batch_report", {
        p_id: id,
        p_export: true,
      }),
      parsed = finalReportSchema.safeParse(result.data);
    if (result.error || !parsed.success)
      return new Response(t("exportError"), { status: 503, headers });
    if (parsed.data.budget_count > 5000)
      return new Response(t("exportLimit"), { status: 413, headers });
    const sheets = finalReportSheets(parsed.data, t);
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
          "Content-Disposition": `attachment; filename="confronto-lotto.${format}"`,
        },
      },
    );
  } catch {
    return new Response(t("exportError"), { status: 503, headers });
  }
}
