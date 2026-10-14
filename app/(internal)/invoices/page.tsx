import { LoadError } from "@/components/shared/load-error";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { externalStatusSchema } from "@/lib/invoicing/types";
import { listInvoices } from "@/modules/invoices/queries";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { AsyncReport } from "@/components/shared/async-report";
import { TableFilter } from "@/components/shared/table-filter";
import { Alert } from "@/components/arc/alert/alert";
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(internalRoles);
  const t = await getTranslations("invoices"),
    params = await searchParams,
    query = parseListQuery(
      params,
      [
        "due_date",
        "issue_date",
        "number",
        "brand",
        "customer",
        "status",
        "gross_cents",
        "paid_cents",
        "balance_cents",
      ],
      "due_date",
    );
  const filter = z
    .object({
      status: z.union([externalStatusSchema, z.literal("all")]).default("all"),
      overdue: z.enum(["all", "yes"]).default("all"),
    })
    .safeParse(params);
  const status =
      filter.success && filter.data.status !== "all"
        ? filter.data.status
        : undefined,
    overdue = filter.success && filter.data.overdue === "yes";
  const filters = [
    {
      name: "status",
      label: t("status"),
      value: status ?? "",
      options: externalStatusSchema.options.map((value) => ({
        value,
        label: t(`statuses.${value}`),
      })),
    },
    {
      name: "overdue",
      label: t("dueFilter"),
      value: overdue ? "yes" : "",
      options: [{ value: "yes", label: t("onlyOverdue") }],
    },
  ];
  const date = (value: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
      new Date(`${value}T00:00:00Z`),
    );
  return (
    <>
      <PageHeader title={t("title")} />
      <p>{t("listHint")}</p>
      {!filter.success ? (
        <>
          {filters.map((field) => (
            <TableFilter key={field.name} base="/invoices" {...field} />
          ))}
          <Alert tone="danger" title={t("validation")} />
        </>
      ) : (
        <AsyncReport
          label={t("loading")}
          load={listInvoices(query, status, overdue)}
          render={(result) =>
            result.error ? (
              <LoadError title={t("loadError")} />
            ) : (
              <ListView
                base="/invoices"

                filters={filters}
                query={query}
                title={t("title")}
                count={result.count ?? 0}
                filterParams={{
                  status: status ?? "all",
                  overdue: overdue ? "yes" : "all",
                }}
                emptyDescription={t("emptyHint")}
                columns={[
                  { key: "number", label: t("number"), linkBase: "/invoices" },
                  { key: "brand", label: t("supplier") },
                  { key: "customer", label: t("customer") },
                  { key: "status", label: t("status") },
                  { key: "due", sortKey: "due_date", label: t("dueDate") },
                  {
                    key: "gross",
                    sortKey: "gross_cents",
                    label: t("gross"),
                    numeric: true,
                  },
                  {
                    key: "paid",
                    sortKey: "paid_cents",
                    label: t("paid"),
                    numeric: true,
                  },
                  {
                    key: "balance",
                    sortKey: "balance_cents",
                    label: t("balance"),
                    numeric: true,
                  },
                ]}
                rows={(result.data ?? []).map((row) => ({
                  id: row.id!,
                  number: row.number!,
                  brand: row.brands?.name ?? "",
                  customer: row.customers?.legal_name ?? "",
                  status: t(`statuses.${row.status}`),
                  due: row.overdue
                    ? t("overdueDate", { date: date(row.due_date!) })
                    : date(row.due_date!),
                  gross: formatMoney(row.gross_cents!),
                  paid: formatMoney(BigInt(row.paid_cents!)),
                  balance: formatMoney(BigInt(row.balance_cents!)),
                }))}
              />
            )
          }
        />
      )}
    </>
  );
}
