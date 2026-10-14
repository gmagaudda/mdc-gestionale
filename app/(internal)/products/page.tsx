import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { listProducts, productBrands } from "@/modules/products/queries";
import { ProductBrandTabs } from "@/modules/products/components/product-brand-tabs";
import { z } from "zod";
import { Alert } from "@/components/arc/alert/alert";
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("catalog");
  const params = await searchParams;
  const query = parseListQuery(
    params,
    ["name", "sku_base", "wholesale_price_cents", "season"],
    "name",
  );
  const filter = z
    .uuid()
    .or(z.literal(""))
    .optional()
    .safeParse(params.brand_id);
  const brands = await productBrands();
  if (brands.error)
    return (
      <>
        <PageHeader title={t("products")} />
        <LoadError title={t("loadError")} />
      </>
    );
  if (
    !filter.success ||
    (filter.data && !brands.data.some((brand) => brand.id === filter.data))
  )
    return (
      <>
        <PageHeader title={t("products")} />
        <Alert tone="danger" title={t("brandUnavailable")}>
          <Link href="/products" className="text-link">
            {t("allBrands")}
          </Link>
        </Alert>
      </>
    );
  const brandId = filter.data || undefined;
  const result = await listProducts(query, brandId);
  const columns = [
    { key: "name", label: t("name"), linkBase: "/products" },
    { key: "sku_base", label: t("sku_base") },
    { key: "season", label: t("season") },
    { key: "wholesale_price_cents", label: t("wholesale_price_cents") },
  ];
  return (
    <>
      <PageHeader
        title={t("products")}
        action={
          result.error &&
          user.role !== "accounting" && (
            <Link className="text-link" href="/products/new">
              {t("createProduct")}
            </Link>
          )
        }
      />
      {result.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <ListView
          base="/products"
          createAction={
            user.role !== "accounting"
              ? { href: "/products/new", label: t("createProduct") }
              : undefined
          }
          query={query}
          filterParams={brandId ? { brand_id: brandId } : {}}
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            sku_base: row.sku_base,
            season: row.seasons?.code ?? "",
            wholesale_price_cents: formatMoney(row.wholesale_price_cents),
          }))}
          count={result.count ?? 0}
          columns={columns}
          title={t("products")}
          wrapTable={(table) => (
            <ProductBrandTabs brands={brands.data} selected={brandId}>
              {table}
            </ProductBrandTabs>
          )}
        />
      )}
    </>
  );
}
