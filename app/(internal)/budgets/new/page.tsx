import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BudgetForm } from "@/modules/budgets/components/budget-form";
import { searchBudgetBrands } from "@/modules/budgets/actions";
export default async function NewBudgetPage() {
  const user = await requireRole(internalRoles);
  if (user.role === "staff") notFound();
  const t = await getTranslations("budgets"),
    result = await searchBudgetBrands("");
  if (!result.ok) throw Error("Budget choices unavailable");
  return (
    <>
      <PageHeader title={t("create")} />
      <BudgetForm brands={result.data} />
    </>
  );
}
