import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { listOrders } from "@/modules/orders/queries";
import { orderFiltersSchema, orderListQuery } from "@/modules/orders/filters";
import { exportCsv } from "@/lib/csv";
import { centsToDecimal } from "@/lib/money";
import { exportSelectionSchema } from "@/lib/exports/selection";
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "brand")
    return new Response(null, { status: 403 });
  const input = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = orderFiltersSchema.safeParse({ ...input, from: "", to: "" });
  const ids = exportSelectionSchema.safeParse(input.ids);
  const t = await getTranslations("orders");
  if (!parsed.success || !ids.success)
    return new Response(t("invalidFilters"), { status: 400 });
  const query = { ...orderListQuery(input), page: 1, size: 500 };
  const first = await listOrders(query, parsed.data, ids.data);
  if (first.error) return new Response(t("loadError"), { status: 503 });
  if ((first.count ?? 0) > 10000)
    return new Response(t("exportTooLarge"), { status: 413 });
  const rows = [...(first.data ?? [])];
  for (let page = 2; rows.length < (first.count ?? 0); page++) {
    const result = await listOrders({ ...query, page }, parsed.data, ids.data);
    if (result.error || !result.data?.length)
      return new Response(t("loadError"), { status: 503 });
    rows.push(...result.data);
  }
  const csv = exportCsv(
    [
      t("number"),
      t("order_date"),
      t("status"),
      t("brand"),
      t("customer"),
      t("season"),
      t("net"),
      t("vat"),
      t("gross"),
    ],
    rows.map((row) => [
      row.number,
      row.order_date,
      t(`statuses.${row.status}`),
      row.brands?.name ?? "",
      row.customers?.legal_name ?? "",
      row.seasons?.code ?? "",
      centsToDecimal(row.net_total_cents).replace(".", ","),
      centsToDecimal(row.vat_total_cents).replace(".", ","),
      centsToDecimal(row.gross_total_cents).replace(".", ","),
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ordini.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
