import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { orderEditorChoices } from "@/modules/orders/queries";
import { OrderEditor } from "@/modules/orders/components/order-editor";
export default async function NewOrderPage() {
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("orders");
  const choices = await orderEditorChoices();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <h1>{t("create")}</h1>
      <OrderEditor
        {...choices}
        initial={{
          header: {
            brand_id: "",
            customer_id: "",
            season_id: "",
            order_date: date,
            delivery_date: "",
            payment_terms: "",
            discount_pct: 0,
            commission_pct_override: null,
            internal_notes: "",
          },
          lines: [],
        }}
      />
    </>
  );
}
