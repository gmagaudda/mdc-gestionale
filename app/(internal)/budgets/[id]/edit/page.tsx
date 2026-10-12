import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getBudget } from "@/modules/budgets/queries";
import { searchBudgetBrands } from "@/modules/budgets/actions";
import { BudgetForm } from "@/modules/budgets/components/budget-form";
import { PageHeader } from "@/components/shared/page-header";
export default async function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(internalRoles);
  if (user.role === "staff") notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data } = await getBudget(id);
  if (!data) notFound();
  const t = await getTranslations("budgets"),
    result = await searchBudgetBrands("");
  if (!result.ok) throw Error("Budget choices unavailable");
  if (!result.data.some((b) => b.value === data.brand_id))
    result.data.push({ value: data.brand_id, label: data.brands?.name ?? "" });
  return (
    <>
      <PageHeader title={t("edit")} />
      <BudgetForm
        brands={result.data}
        existing={{
          id: data.id,
          updated_at: data.updated_at,
          brand_id: data.brand_id,
          season_id: data.season_id ?? "",
          customer_id: data.customer_id ?? "",
          amount_cents: data.amount_cents,
          period_start: data.period_start,
          period_end: data.period_end,
          notes: data.budget_private?.[0]?.notes ?? "",
          season_name: data.seasons?.name,
          customer_name: data.customers?.legal_name,
        }}
      />
    </>
  );
}
