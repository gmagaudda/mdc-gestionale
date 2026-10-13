import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { exportCsv } from "@/lib/csv";
import { centsToDecimal } from "@/lib/money";
import { exportSelectionSchema } from "@/lib/exports/selection";
import { parseColumnFilters } from "@/lib/queries/column-filters";
import { captureColumnFilters } from "@/lib/queries/list";
import {
  listExports,
  listExportEntitySchema,
  listExportFiltersSchema,
  listExportReportSchema,
} from "@/lib/exports/lists";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401, headers });
  if (!internalRoles.includes(user.role))
    return new Response(null, { status: 403, headers });
  const entity = listExportEntitySchema.safeParse((await params).entity);
  if (!entity.success) return new Response(null, { status: 404, headers });
  const input = Object.fromEntries(new URL(request.url).searchParams);
  const filters = listExportFiltersSchema.safeParse(input);
  const columns = parseColumnFilters(captureColumnFilters(input), entity.data);
  const ids = exportSelectionSchema.safeParse(input.ids);
  const t = await getTranslations("lists");
  const config = listExports[entity.data];
  if (
    !filters.success ||
    !columns.ok ||
    !ids.success ||
    (filters.data.sort && !config.sort.includes(filters.data.sort))
  )
    return new Response(t("exportInvalid"), { status: 400, headers });
  const response = await (
    await createClient()
  ).rpc("export_business_list", {
    p_entity: entity.data,
    p_q: filters.data.q,
    p_sort: filters.data.sort ?? config.sort[0],
    p_direction: filters.data.direction,
    p_status: filters.data.status,
    p_overdue: filters.data.overdue === "yes",
    p_column_filters: columns.data,
    ...(ids.data ? { p_ids: [...new Set(ids.data)] } : {}),
  });
  const parsed = listExportReportSchema.safeParse(response.data);
  if (response.error || !parsed.success)
    return new Response(t("exportError"), { status: 503, headers });
  if (parsed.data.rows.length > 10000)
    return new Response(t("exportTooLarge"), { status: 413, headers });
  const labels = await getTranslations(config.namespace);
  try {
    const csv = exportCsv(
      config.columns.map((column) => labels(column.label)),
      parsed.data.rows.map((row) =>
        config.columns.map((column) => {
          const value = row[column.key];
          if (column.kind === "money") {
            if (typeof value !== "string" || !/^-?\d+$/.test(value))
              throw Error("Invalid export money");
            return centsToDecimal(BigInt(value));
          }
          if (column.kind === "status") return labels(`statuses.${value}`);
          if (column.kind === "documentKind") return labels(`kinds.${value}`);
          if (column.kind === "visibility")
            return labels(value ? "sharedState" : "internalState");
          return value == null ? "" : String(value);
        }),
      ),
    );
    return new Response(csv, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity.data}.csv"`,
      },
    });
  } catch {
    return new Response(t("exportError"), { status: 503, headers });
  }
}
