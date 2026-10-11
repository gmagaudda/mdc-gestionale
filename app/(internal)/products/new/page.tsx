import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { ProductForm } from "@/modules/products/components/product-form";
import { catalogChoices } from "@/modules/seasons/queries";
export default async function NewProductPage() {
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("catalog");
  const choices = await catalogChoices();
  return (
    <>
      <h1>{t("createProduct")}</h1>
      <ProductForm {...choices} />
    </>
  );
}
