import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { parseListQuery } from "@/lib/queries/list";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { ListView } from "@/components/shared/list-view";
import { listProducts } from "@/modules/products/queries";
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("catalog");
  const query = parseListQuery(
    await searchParams,
    ["name", "sku_base", "wholesale_price_cents", "brand", "season"],
    "name",
  );
  const result = await listProducts(query);
  const columns = [
    { key: "name", label: t("name"), linkBase: "/products" },
    { key: "sku_base", label: t("sku_base") },
    { key: "brand", label: t("brand") },
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
          rows={(result.data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            sku_base: row.sku_base,
            brand: row.brands?.name ?? "",
            season: row.seasons?.code ?? "",
            wholesale_price_cents: formatMoney(row.wholesale_price_cents),
          }))}
          count={result.count ?? 0}
          columns={columns}
          title={t("products")}
          searchLabel={t("search")}
        />
      )}
    </>
  );
}
