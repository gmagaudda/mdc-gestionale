import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getOrder, orderEditorChoices } from "@/modules/orders/queries";
import { OrderEditor } from "@/modules/orders/components/order-editor";
import { Alert } from "@/components/arc/alert/alert";
export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const { data } = await getOrder(id);
  if (!data || data.status !== "draft") notFound();
  const choices = await orderEditorChoices(
    data.customer_id,
    data.order_lines.map((line) => line.variant_id),
    { brand_id: data.brand_id, season_id: data.season_id },
  );
  const t = await getTranslations("orders");
  return (
    <>
      <h1>{t("edit", { number: data.number })}</h1>
      {(await searchParams).saved === "1" && (
        <Alert tone="success" title={t("saved")} />
      )}
      <OrderEditor
        key={id}
        id={id}
        {...choices}
        initial={{
          header: {
            brand_id: data.brand_id,
            customer_id: data.customer_id,
            season_id: data.season_id,
            order_date: data.order_date,
            delivery_date: data.delivery_date ?? "",
            payment_terms: data.payment_terms,
            discount_pct: data.discount_pct,
            commission_pct_override:
              data.order_private?.[0]?.commission_pct_override ?? null,
            internal_notes: data.order_private?.[0]?.internal_notes ?? "",
          },
          lines: data.order_lines.map((line) => ({
            variant_id: line.variant_id,
            quantity: line.quantity,
            unit_price_cents: line.unit_price_cents,
            discount_pct: line.discount_pct,
          })),
          vatRates: Object.fromEntries(
            data.order_lines.map((line) => [line.variant_id, line.vat_rate]),
          ),
        }}
        serverTotals={{
          net: data.net_total_cents,
          vat: data.vat_total_cents,
          gross: data.gross_total_cents,
        }}
      />
    </>
  );
}
