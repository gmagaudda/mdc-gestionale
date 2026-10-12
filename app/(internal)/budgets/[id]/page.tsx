import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/money";
import { getBudget } from "@/modules/budgets/queries";
import { archiveBudget } from "@/modules/budgets/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Alert } from "@/components/arc/alert/alert";
export default async function BudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireRole(internalRoles),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data } = await getBudget(id);
  if (!data) notFound();
  const t = await getTranslations("budgets"),
    date = (value: string) =>
      new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
        new Date(`${value}T00:00:00Z`),
      );
  return (
    <>
      <Link className="text-link" href="/budgets">
        {t("all")}
      </Link>
      <h1>{t("detail", { brand: data.brands?.name ?? "" })}</h1>
      {(await searchParams).saved === "1" && (
        <Alert tone="success" title={t("saved")} />
      )}
      {user.role !== "staff" && (
        <Link className="text-link" href={`/budgets/${id}/edit`}>
          {t("edit")}
        </Link>
      )}
      <dl className="details-grid">
        <div>
          <dt>{t("amount")}</dt>
          <dd className="tabular-nums">{formatMoney(data.amount_cents)}</dd>
        </div>
        <div>
          <dt>{t("brand")}</dt>
          <dd>{data.brands?.name}</dd>
        </div>
        <div>
          <dt>{t("season")}</dt>
          <dd>{data.seasons?.code ?? t("none")}</dd>
        </div>
        <div>
          <dt>{t("customer")}</dt>
          <dd>{data.customers?.legal_name ?? t("none")}</dd>
        </div>
        <div>
          <dt>{t("period")}</dt>
          <dd>
            {t("periodValue", {
              start: date(data.period_start),
              end: date(data.period_end),
            })}
          </dd>
        </div>
        <div>
          <dt>{t("notes")}</dt>
          <dd className="whitespace-pre-wrap">
            {data.budget_private?.[0]?.notes || t("noNotes")}
          </dd>
        </div>
      </dl>
      {user.role !== "staff" && (
        <ConfirmAction
          label={t("archive")}
          question={t("archiveQuestion")}
          action={archiveBudget.bind(null, id)}
          destination="/budgets"
        />
      )}
    </>
  );
}
