import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/money";
import { getProduct } from "@/modules/products/queries";
import { archiveProduct } from "@/modules/products/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { DataTable } from "@/components/shared/data-table";
import { Alert } from "@/components/arc/alert/alert";
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireRole(internalRoles);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const { data } = await getProduct(id);
  if (!data) notFound();
  const t = await getTranslations("catalog");
  const variants = data.product_variants
    .filter((row) => !row.deleted_at)
    .sort(
      (a, b) =>
        a.color.localeCompare(b.color, "it") ||
        a.size.localeCompare(b.size, "it"),
    );
  return (
    <>
      <Link href="/products" className="text-link">
        {t("allProducts")}
      </Link>
      <h1>{data.name}</h1>
      {(await searchParams).saved === "1" && (
        <Alert tone="success" title={t("saved")} />
      )}
      {user.role !== "accounting" && (
        <Link className="text-link" href={`/products/${id}/edit`}>
          {t("editProduct")}
        </Link>
      )}
      <dl className="details-grid">
        <div>
          <dt>{t("sku_base")}</dt>
          <dd>{data.sku_base}</dd>
        </div>
        <div>
          <dt>{t("brand")}</dt>
          <dd>{data.brands?.name}</dd>
        </div>
        <div>
          <dt>{t("season")}</dt>
          <dd>
            {data.seasons?.code}: {data.seasons?.name}
          </dd>
        </div>
        <div>
          <dt>{t("wholesale_price_cents")}</dt>
          <dd className="tabular-nums">
            {formatMoney(data.wholesale_price_cents)}
          </dd>
        </div>
        <div>
          <dt>{t("retail_price_cents")}</dt>
          <dd className="tabular-nums">
            {formatMoney(data.retail_price_cents)}
          </dd>
        </div>
        <div>
          <dt>{t("vat_rate")}</dt>
          <dd>{new Intl.NumberFormat("it-IT").format(data.vat_rate)}%</dd>
        </div>
      </dl>
      <p>{data.description}</p>
      <h2>{t("variants")}</h2>
      <p role="status">{t("variantCount", { count: variants.length })}</p>
      <DataTable
        rows={variants}
        columns={[
          { key: "size", label: t("size") },
          { key: "color", label: t("color") },
          { key: "sku", label: t("sku"), copyValue: true },
        ]}
        caption={t("variants")}
        emptyMessage={t("noVariants")}
      />
      {user.role !== "accounting" && (
        <ConfirmAction
          label={t("archiveProduct")}
          question={t("archiveProductQuestion")}
          action={archiveProduct.bind(null, id)}
          destination="/products"
        />
      )}
    </>
  );
}
