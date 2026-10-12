import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/arc/badge/badge";
export default async function Order({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["brand"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient(),
    result = await db
      .from("portal_orders")
      .select(
        "id,number,brand_id,season_id,status,order_date,delivery_date,net_total_cents,vat_total_cents,gross_total_cents,customer_display_name,customer_city",
      )
      .eq("id", id)
      .maybeSingle();
  if (result.error) throw Error("Portal order unavailable");
  const o = result.data;
  if (!o?.brand_id || !o.season_id) notFound();
  const [brand, season, lines, terms] = await Promise.all([
    db.from("brands").select("name").eq("id", o.brand_id).single(),
    db.from("seasons").select("code,name").eq("id", o.season_id).single(),
    db
      .from("order_lines")
      .select(
        "id,product_name,sku,color,size,quantity,unit_price_cents,discount_pct,line_net_cents",
      )
      .eq("order_id", id)
      .order("sku"),
    db
      .from("orders")
      .select("payment_terms,discount_pct")
      .eq("id", id)
      .single(),
  ]);
  if (brand.error || season.error || lines.error || terms.error)
    throw Error("Portal order data unavailable");
  const t = await getTranslations("orders"),
    p = await getTranslations("portal"),
    pdf = await getTranslations("pdf"),
    date = (v: string | null) =>
      v
        ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
            new Date(`${v}T00:00:00Z`),
          )
        : t("notSet");
  return (
    <>
      <h1>{t("detail", { number: o.number ?? "" })}</h1>
      <p>{p("ordersReadonly")}</p>
      <a className="text-link" href={`/api/pdf/order-confirmation/${id}`}>
        {pdf("downloadOrder")}
      </a>
      <a className="text-link" href={`/api/pdf/line-sheet/${o.season_id}`}>
        {pdf("downloadLineSheet")}
      </a>
      <div>
        <Badge tone={o.status === "cancelled" ? "danger" : "neutral"}>
          {t(`statuses.${o.status}`)}
        </Badge>
      </div>
      <dl className="details-grid">
        {[
          [t("brand"), brand.data.name],
          [t("season"), `${season.data.code} · ${season.data.name}`],
          [
            t("customer"),
            [o.customer_display_name, o.customer_city]
              .filter(Boolean)
              .join(" · "),
          ],
          [t("order_date"), date(o.order_date)],
          [t("delivery_date"), date(o.delivery_date)],
          [t("payment_terms"), terms.data.payment_terms || t("notSet")],
          [
            t("discount_pct"),
            `${new Intl.NumberFormat("it-IT").format(terms.data.discount_pct)}%`,
          ],
          [t("net"), formatMoney(o.net_total_cents ?? 0)],
          [t("vat"), formatMoney(o.vat_total_cents ?? 0)],
          [t("gross"), formatMoney(o.gross_total_cents ?? 0)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h2>{t("lines")}</h2>
      <DataTable
        caption={t("lines")}
        emptyMessage={t("emptyProducts")}
        rows={lines.data.map((l) => ({
          id: l.id,
          product: l.product_name,
          sku: l.sku,
          color: l.color,
          size: l.size,
          quantity: l.quantity,
          price: formatMoney(l.unit_price_cents),
          discount: `${new Intl.NumberFormat("it-IT").format(l.discount_pct)}%`,
          net: formatMoney(l.line_net_cents),
        }))}
        columns={[
          { key: "product", label: t("products") },
          { key: "sku", label: t("sku") },
          { key: "color", label: t("color") },
          { key: "size", label: t("size") },
          { key: "quantity", label: t("quantity") },
          { key: "price", label: t("unit_price_cents") },
          { key: "discount", label: t("line_discount_pct") },
          { key: "net", label: t("net") },
        ]}
      />
    </>
  );
}
