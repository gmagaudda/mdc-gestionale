import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getProduct } from "@/modules/products/queries";
import { catalogChoices } from "@/modules/seasons/queries";
import { ProductForm } from "@/modules/products/components/product-form";
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const [result, choices] = await Promise.all([
    getProduct(id),
    catalogChoices(),
  ]);
  const data = result.data;
  if (!data) notFound();
  const t = await getTranslations("catalog");
  const variants = data.product_variants.filter((row) => !row.deleted_at);
  return (
    <>
      <h1>{t("editProduct")}</h1>
      <ProductForm
        id={id}
        {...choices}
        initial={{
          brand_id: data.brand_id,
          season_id: data.season_id,
          sku_base: data.sku_base,
          name: data.name,
          description: data.description,
          wholesale_price_cents: data.wholesale_price_cents,
          retail_price_cents: data.retail_price_cents,
          vat_rate: data.vat_rate,
          sizes: [...new Set(variants.map((row) => row.size))],
          colors: [...new Set(variants.map((row) => row.color))],
        }}
      />
    </>
  );
}
