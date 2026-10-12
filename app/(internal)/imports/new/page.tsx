import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { PerformanceImport } from "@/modules/imports/components/performance-import";
export default async function NewImport() {
  if ((await getSessionUser())?.role !== "admin") notFound();
  const t = await getTranslations("imports");
  return (
    <>
      <PageHeader title={t("new")} description={t("historicalHint")} />
      <PerformanceImport />
    </>
  );
}
