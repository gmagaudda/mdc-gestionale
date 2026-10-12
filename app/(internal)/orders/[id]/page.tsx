import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/money";
import { getOrder, getOrderHistory } from "@/modules/orders/queries";
import { GenerateInvoice } from "@/modules/invoices/components/generate-invoice";
import { getOrderInvoice } from "@/modules/invoices/queries";
import { invoicingProviderName } from "@/lib/invoicing";
import { OrderActions } from "@/modules/orders/components/order-actions";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(internalRoles);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const [result, history] = await Promise.all([
    getOrder(id),
    getOrderHistory(id),
  ]);
  const order = result.data;
  if (!order) notFound();
  const t = await getTranslations("orders");
  const pdf = await getTranslations("pdf");
  const date = (value: string) =>
    new Intl.DateTimeFormat("it-IT", {
      dateStyle: "short",
      timeZone: "Europe/Rome",
    }).format(new Date(`${value}T12:00:00Z`));
  const privateData = order.order_private[0];
  const invoice = await getOrderInvoice(id);
  const billing = await getTranslations("invoices");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <PageHeader
        title={t("detail", { number: order.number })}
        action={
          order.status === "draft" &&
          user.role !== "accounting" && (
            <Link className="text-link" href={`/orders/${id}/edit`}>
              {t("editDraft")}
            </Link>
          )
        }
      />
      <a className="text-link" href={`/api/pdf/order-confirmation/${id}`}>
        {pdf("downloadOrder")}
      </a>
      <div>
        <Badge
          key={order.status}
          tone={
            order.status === "cancelled"
              ? "danger"
              : order.status === "delivered" || order.status === "invoiced"
                ? "success"
                : "neutral"
          }
        >
          <span>{t(`statuses.${order.status}`)}</span>
        </Badge>
      </div>
      <dl className="details-grid">
        <div>
          <dt>{t("brand")}</dt>
          <dd>{order.brands?.name}</dd>
        </div>
        <div>
          <dt>{t("customer")}</dt>
          <dd>
            {order.customers?.legal_name}
            {order.customers?.city && ` · ${order.customers.city}`}
          </dd>
        </div>
        <div>
          <dt>{t("season")}</dt>
          <dd>
            {order.seasons?.code}: {order.seasons?.name}
          </dd>
        </div>
        <div>
          <dt>{t("order_date")}</dt>
          <dd>{date(order.order_date)}</dd>
        </div>
        <div>
          <dt>{t("delivery_date")}</dt>
          <dd>
            {order.delivery_date ? date(order.delivery_date) : t("notSet")}
          </dd>
        </div>
        <div>
          <dt>{t("payment_terms")}</dt>
          <dd>{order.payment_terms || t("notSet")}</dd>
        </div>
        <div>
          <dt>{t("discount_pct")}</dt>
          <dd className="tabular-nums">
            {new Intl.NumberFormat("it-IT").format(order.discount_pct)}%
          </dd>
        </div>
        <div>
          <dt>{t("commission_pct_override")}</dt>
          <dd>
            {privateData?.commission_pct_override === null ||
            privateData?.commission_pct_override === undefined
              ? t("defaultCommission")
              : new Intl.NumberFormat("it-IT").format(
                  privateData.commission_pct_override,
                ) + "%"}
          </dd>
        </div>
        <div>
          <dt>{t("net")}</dt>
          <dd className="tabular-nums">{formatMoney(order.net_total_cents)}</dd>
        </div>
        <div>
          <dt>{t("vat")}</dt>
          <dd className="tabular-nums">{formatMoney(order.vat_total_cents)}</dd>
        </div>
        <div>
          <dt>{t("gross")}</dt>
          <dd className="tabular-nums">
            {formatMoney(order.gross_total_cents)}
          </dd>
        </div>
      </dl>
      <section className="stack">
        <h2>{t("lines")}</h2>
        <DataTable
          caption={t("lines")}
          emptyMessage={t("emptyProducts")}
          columns={[
            { key: "product", label: t("products") },
            { key: "sku", label: t("sku"), copyValue: true },
            { key: "color", label: t("color") },
            { key: "size", label: t("size") },
            { key: "quantity", label: t("quantity"), numeric: true },
            { key: "price", label: t("unit_price_cents"), numeric: true },
            { key: "discount", label: t("line_discount_pct"), numeric: true },
            { key: "vat", label: t("vat_rate"), numeric: true },
            { key: "net", label: t("net"), numeric: true },
          ]}
          rows={order.order_lines.map((line) => ({
            id: line.id,
            product: line.product_name,
            sku: line.sku,
            color: line.color,
            size: line.size,
            quantity: line.quantity,
            price: formatMoney(line.unit_price_cents),
            discount:
              new Intl.NumberFormat("it-IT").format(line.discount_pct) + "%",
            vat: new Intl.NumberFormat("it-IT").format(line.vat_rate) + "%",
            net: formatMoney(line.line_net_cents),
          }))}
        />
      </section>
      <section className="stack">
        <h2>{t("internal_notes")}</h2>
        <p className="preserve-text">
          {privateData?.internal_notes || t("notSet")}
        </p>
      </section>
      <OrderActions id={id} status={order.status} role={user.role} />
      {invoice.error ? (
        <Alert tone="danger" title={billing("loadError")} />
      ) : invoice.data ? (
        <Link className="text-link" href={`/invoices/${invoice.data.id}`}>
          {billing("openInvoice")}
        </Link>
      ) : order.status === "delivered" && user.role !== "staff" ? (
        <GenerateInvoice
          orderId={id}
          today={today}
          mock={invoicingProviderName() === "mock"}
        />
      ) : null}
      <section className="stack" aria-label={t("history")}>
        <h2>{t("history")}</h2>
        {history.error ? (
          <LoadError title={t("loadError")} />
        ) : (
          <ol className="stack">
            {history.data?.map((row) => (
              <li key={row.id} className="stack">
                <p>
                  {row.from_status
                    ? t("historyChange", {
                        from: t(`statuses.${row.from_status}`),
                        to: t(`statuses.${row.to_status}`),
                      })
                    : t("historyCreated")}
                </p>
                <time dateTime={row.changed_at}>
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "short",
                    timeStyle: "medium",
                    timeZone: "Europe/Rome",
                  }).format(new Date(row.changed_at))}
                </time>
                {row.note && <p className="preserve-text">{row.note}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <Link className="text-link" href="/orders">
        {t("backToOrders")}
      </Link>
    </>
  );
}
