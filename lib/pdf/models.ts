import "server-only";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { PdfData, PdfType } from "./types";
import type { DashboardFilters } from "@/modules/dashboard/schema";
import { brandSummarySchema, PdfSummaryTooLarge } from "./summary-schema";
export async function getPdfModel(
  type: PdfType,
  id: string,
  filters?: DashboardFilters,
): Promise<PdfData | null> {
  const db = await createClient();
  const user = await getSessionUser();
  if (!user) return null;
  const t = await getTranslations("orders");
  const p = await getTranslations("pdf");
  const labels = Object.fromEntries(
    [
      "customer",
      "order_date",
      "delivery_date",
      "status",
      "payment_terms",
      "discount_pct",
      "products",
      "quantity",
      "unit_price_cents",
      "line_discount_pct",
      "net",
      "vat",
      "gross",
      "sku",
      "vat_rate",
      "emptyProducts",
    ].map((key) => [key, t(key)]),
  );
  Object.assign(labels, {
    variant: p("variant"),
    page: p("page"),
    variants: p("variants"),
    retail: p("retail"),
  });
  if (type === "brand-summary") {
    const brand = await db
      .from("brands")
      .select("name")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (brand.error) throw Error("PDF brand unavailable");
    if (!brand.data) return null;
    let seasonName = p("allSeasons");
    if (filters?.season_id) {
      const season = await db
        .from("seasons")
        .select("code,name")
        .eq("id", filters.season_id)
        .eq("brand_id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (season.error) throw Error("PDF season unavailable");
      if (!season.data) return null;
      seasonName = `${season.data.code}: ${season.data.name}`;
    }
    const summary = await db.rpc("brand_sales_summary", {
      p_brand_id: id,
      ...(filters?.season_id ? { p_season_id: filters.season_id } : {}),
      ...(filters?.from ? { p_start: filters.from } : {}),
      ...(filters?.to ? { p_end: filters.to } : {}),
    });
    const parsed = brandSummarySchema.safeParse(summary.data);
    if (summary.error || !parsed.success)
      throw Error("PDF summary unavailable");
    if (parsed.data.count > 1000) throw new PdfSummaryTooLarge();
    const date = (value: string) =>
      new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
        new Date(`${value}T12:00:00Z`),
      );
    const period =
      filters?.from || filters?.to
        ? p("summaryPeriod", {
            from: filters.from ? date(filters.from) : p("startUnbounded"),
            to: filters.to ? date(filters.to) : p("endUnbounded"),
          })
        : p("allDates");
    return {
      type,
      title: p("summaryTitle"),
      brand: brand.data.name,
      season: seasonName,
      period,
      report: parsed.data,
      labels: {
        ...labels,
        customer: t("customer"),
        season: t("season"),
        orders: p("orders"),
        empty: p("emptySummary"),
        definition: p("summaryDefinition"),
      },
    };
  }
  if (type === "order-confirmation") {
    // The privacy view applies the same customer-name flag to downloads as to the portal.
    const order = await db
      .from("portal_orders")
      .select("*")
      .eq("id", id)
      .single();
    if (!order.data?.brand_id || !order.data.season_id) return null;
    const [brand, season, lines, terms] = await Promise.all([
      db.from("brands").select("name").eq("id", order.data.brand_id).single(),
      db
        .from("seasons")
        .select("code,name")
        .eq("id", order.data.season_id)
        .single(),
      db
        .from("order_lines")
        .select(
          "product_name,sku,color,size,quantity,unit_price_cents,discount_pct,line_net_cents",
        )
        .eq("order_id", id)
        .order("product_name")
        .order("sku"),
      db
        .from("orders")
        .select("payment_terms,discount_pct,customer_id")
        .eq("id", id)
        .single(),
    ]);
    if (brand.error || season.error || lines.error || terms.error)
      throw Error("PDF data unavailable");
    let customerName = order.data.customer_display_name;
    let customerCity = order.data.customer_city;
    if (user.role !== "brand") {
      const customer = await db
        .from("customers")
        .select("legal_name,city")
        .eq("id", terms.data.customer_id)
        .single();
      if (customer.error) throw Error("PDF customer unavailable");
      customerName = customer.data.legal_name;
      customerCity = customer.data.city;
    }
    const date = (value: string | null) =>
      value
        ? new Intl.DateTimeFormat("it-IT", {
            dateStyle: "short",
            timeZone: "Europe/Rome",
          }).format(new Date(`${value}T12:00:00Z`))
        : t("notSet");
    return {
      type,
      title: p("orderTitle", { number: order.data.number ?? "" }),
      brand: brand.data.name,
      season: `${season.data.code}: ${season.data.name}`,
      customer: [customerName, customerCity].filter(Boolean).join(" · "),
      date: date(order.data.order_date),
      delivery: date(order.data.delivery_date),
      status: t(`statuses.${order.data.status}`),
      payment: terms.data.payment_terms || t("notSet"),
      discount: terms.data.discount_pct,
      lines: lines.data.map((line) => ({
        name: line.product_name,
        sku: line.sku,
        variant: `${line.color} / ${line.size}`,
        quantity: line.quantity,
        price: line.unit_price_cents,
        discount: line.discount_pct,
        net: line.line_net_cents,
      })),
      net: order.data.net_total_cents ?? 0,
      vat: order.data.vat_total_cents ?? 0,
      gross: order.data.gross_total_cents ?? 0,
      labels,
    };
  }
  const season = await db
    .from("seasons")
    .select("brand_id,code,name,brands(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!season.data) return null;
  const query = () =>
    db
      .from("products")
      .select(
        "name,sku_base,description,wholesale_price_cents,retail_price_cents,vat_rate,product_variants(size,color,deleted_at)",
      )
      .eq("season_id", id)
      .is("deleted_at", null)
      .order("name")
      .order("id");
  const products: NonNullable<Awaited<ReturnType<typeof query>>["data"]> = [];
  for (let offset = 0; ; offset += 500) {
    const chunk = await query().range(offset, offset + 499);
    if (chunk.error) throw Error("PDF catalog unavailable");
    products.push(...chunk.data);
    if (products.length > 5000) throw Error("PDF catalog too large");
    if (chunk.data.length < 500) break;
  }
  return {
    type,
    title: p("lineSheetTitle"),
    brand: season.data.brands?.name ?? "",
    season: `${season.data.code}: ${season.data.name}`,
    products: products.map((product) => ({
      name: product.name,
      sku: product.sku_base,
      description: product.description,
      price: product.wholesale_price_cents,
      retail: product.retail_price_cents,
      vat: product.vat_rate,
      variants: product.product_variants
        .filter((variant) => !variant.deleted_at)
        .map((variant) => `${variant.color} / ${variant.size}`),
    })),
    labels,
  };
}
