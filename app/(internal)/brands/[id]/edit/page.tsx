import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { getBrand } from "@/modules/brands/queries";
import { uuid } from "zod";
import { BrandForm } from "@/modules/brands/components/brand-form";
import { emptyBrand } from "@/modules/brands/schema";
export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const { brand } = await getBrand(id);
  if (!brand.data) notFound();
  const t = await getTranslations("brands");
  return (
    <>
      <h1>{t("edit")}</h1>
      <BrandForm
        id={id}
        initial={{ ...emptyBrand, ...brand.data, ...brand.data.brand_private }}
      />
    </>
  );
}
