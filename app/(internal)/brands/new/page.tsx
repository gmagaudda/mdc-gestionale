import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { BrandForm } from "@/modules/brands/components/brand-form";
export default async function NewBrandPage() {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const t = await getTranslations("brands");
  return (
    <>
      <h1>{t("create")}</h1>
      <BrandForm />
    </>
  );
}
