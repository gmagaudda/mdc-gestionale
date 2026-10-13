import "server-only";
import { escapeLike } from "@/lib/queries/list";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
export type MatrixProduct = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  | "id"
  | "brand_id"
  | "season_id"
  | "name"
  | "sku_base"
  | "wholesale_price_cents"
  | "vat_rate"
  | "deleted_at"
> & {
  product_variants: Database["public"]["Tables"]["product_variants"]["Row"][];
};
export async function orderEditorChoices(
  customerId?: string,
  variantIds: string[] = [],
  current?: { brand_id: string; season_id: string },
) {
  const db = await createClient();
  const productColumns =
    "id,brand_id,season_id,name,sku_base,wholesale_price_cents,vat_rate,deleted_at,product_variants(*)" as const;
  const [brands, seasons, products, customers] = await Promise.all([
    db.from("brands").select("id,name").is("deleted_at", null).order("name"),
    db
      .from("seasons")
      .select("id,brand_id,code,name")
      .is("deleted_at", null)
      .order("code"),
    db
      .from("products")
      .select(productColumns)
      .is("deleted_at", null)
      .order("name"),
    db
      .from("customers")
      .select("id,legal_name,city")
      .is("deleted_at", null)
      .order("legal_name")
      .limit(50),
  ]);
  if (brands.error || seasons.error || products.error || customers.error)
    throw Error("Order choices unavailable");
  if (current) {
    if (!brands.data.some((row) => row.id === current.brand_id)) {
      const extra = await db
        .from("brands")
        .select("id,name")
        .eq("id", current.brand_id)
        .single();
      if (extra.error) throw Error("Order brand unavailable");
      brands.data.push(extra.data);
    }
    if (!seasons.data.some((row) => row.id === current.season_id)) {
      const extra = await db
        .from("seasons")
        .select("id,brand_id,code,name")
        .eq("id", current.season_id)
        .single();
      if (extra.error) throw Error("Order season unavailable");
      seasons.data.push(extra.data);
    }
  }
  if (customerId && !customers.data.some((row) => row.id === customerId)) {
    const current = await db
      .from("customers")
      .select("id,legal_name,city")
      .eq("id", customerId)
      .single();
    if (current.data) customers.data.unshift(current.data);
  }
  if (variantIds.length) {
    const linked = await db
      .from("product_variants")
      .select("product_id")
      .in("id", variantIds);
    if (linked.error) throw Error("Linked catalog unavailable");
    const missing = [
      ...new Set(linked.data.map((row) => row.product_id)),
    ].filter((id) => !products.data.some((row) => row.id === id));
    if (missing.length) {
      const extra = await db
        .from("products")
        .select(productColumns)
        .in("id", missing);
      if (extra.error) throw Error("Linked products unavailable");
      products.data.push(...extra.data);
    }
  }
  return {
    brands: brands.data,
    seasons: seasons.data,
    products: products.data.map((row) => ({
      ...row,
      product_variants: row.product_variants.filter(
        (variant) =>
          variantIds.includes(variant.id) ||
          (!row.deleted_at && !variant.deleted_at),
      ),
    })),
    customers: customers.data,
  };
}
export async function getOrder(id: string) {
  const db = await createClient();
  return db
    .from("orders")
    .select(
      "*,order_private(*),order_lines(*),customers(legal_name,city),brands(name),seasons(code,name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();
}

export async function listOrders(
  query: import("@/lib/queries/list").ListQuery,
  filters: import("./filters").OrderFilters,
  ids?: string[],
) {
  const db = await createClient();
  let request = db
    .from("orders")
    .select(
      "id,number,order_date,status,net_total_cents,vat_total_cents,gross_total_cents,brands(name),customers(legal_name,city),seasons(code)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range((query.page - 1) * query.size, query.page * query.size - 1);
  if (query.q) request = request.ilike("number", `%${escapeLike(query.q)}%`);
  if (ids) request = request.in("id", ids);
  if (filters.status) request = request.eq("status", filters.status);
  if (filters.brand_id) request = request.eq("brand_id", filters.brand_id);
  if (filters.customer_id)
    request = request.eq("customer_id", filters.customer_id);
  if (filters.season_id) request = request.eq("season_id", filters.season_id);
  if (filters.from) request = request.gte("order_date", filters.from);
  if (filters.to) request = request.lte("order_date", filters.to);
  return request;
}
export async function orderFilterChoices(customerId = "") {
  const db = await createClient();
  const [brands, seasons, customers] = await Promise.all([
    db.from("brands").select("id,name").order("name"),
    db.from("seasons").select("id,brand_id,code,name").order("code"),
    db
      .from("customers")
      .select("id,legal_name,city")
      .order("legal_name")
      .limit(50),
  ]);
  if (brands.error || seasons.error || customers.error)
    throw Error("Order filters unavailable");
  if (customerId && !customers.data.some((row) => row.id === customerId)) {
    const current = await db
      .from("customers")
      .select("id,legal_name,city")
      .eq("id", customerId)
      .single();
    if (current.data) customers.data.push(current.data);
  }
  return {
    brands: brands.data,
    seasons: seasons.data,
    customers: customers.data,
  };
}
export async function getOrderHistory(id: string) {
  const db = await createClient();
  return db
    .from("order_status_history")
    .select("id,from_status,to_status,changed_at,note")
    .eq("order_id", id)
    .order("changed_at")
    .order("id");
}
