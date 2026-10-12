import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/money";
import { getInvoice } from "@/modules/invoices/queries";
import { invoicePartySchema, invoiceLineSchema } from "@/lib/invoicing/types";
import { InvoiceControls } from "@/modules/invoices/components/invoice-controls";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(internalRoles);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await getInvoice(id);
  if (result.error) throw Error("Invoice unavailable");
  const invoice = result.data;
  if (!invoice) notFound();
  const t = await getTranslations("invoices");
  const paid = invoice.payments.reduce(
      (sum, p) => sum + BigInt(p.amount_cents),
      0n,
    ),
    balance = BigInt(invoice.gross_cents) - paid;
  const date = (value: string) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
      new Date(`${value}T00:00:00Z`),
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const supplier = invoicePartySchema.safeParse(invoice.supplier_snapshot),
    customer = invoicePartySchema.safeParse(invoice.customer_snapshot),
    lines = z.array(invoiceLineSchema).safeParse(invoice.lines_snapshot);
  return (
    <>
      <PageHeader title={t("detail", { number: invoice.number })} />
      {invoice.provider === "mock" && (
        <Alert tone="info" title={t("mockHint")} />
      )}
      <div>
        <Badge
          tone={
            invoice.status === "paid"
              ? "success"
              : ["cancelled", "rejected"].includes(invoice.status)
                ? "danger"
                : "neutral"
          }
        >
          <span>{t(`statuses.${invoice.status}`)}</span>
        </Badge>
      </div>
      {invoice.processing_status === "failed" && (
        <Alert
          tone="danger"
          title={t(
            invoice.processing_kind === "cancel"
              ? "cancellationFailed"
              : "issueFailed",
          )}
        >
          {t("retryHint")}
        </Alert>
      )}
      {invoice.processing_status === "processing" && (
        <Alert tone="info" title={t("processing")}>
          {t("processingHint")}
        </Alert>
      )}
      <dl className="details-grid">
        <div>
          <dt>{t("supplier")}</dt>
          <dd>
            {supplier.success ? supplier.data.legal_name : invoice.brands?.name}
          </dd>
        </div>
        <div>
          <dt>{t("customer")}</dt>
          <dd>
            {customer.success
              ? customer.data.legal_name
              : invoice.customers?.legal_name}
          </dd>
        </div>
        <div>
          <dt>{t("issueDate")}</dt>
          <dd>{date(invoice.issue_date)}</dd>
        </div>
        <div>
          <dt>{t("dueDate")}</dt>
          <dd>{date(invoice.due_date)}</dd>
        </div>
        <div>
          <dt>{t("net")}</dt>
          <dd className="tabular-nums">{formatMoney(invoice.net_cents)}</dd>
        </div>
        <div>
          <dt>{t("vat")}</dt>
          <dd className="tabular-nums">{formatMoney(invoice.vat_cents)}</dd>
        </div>
        <div>
          <dt>{t("gross")}</dt>
          <dd className="tabular-nums">{formatMoney(invoice.gross_cents)}</dd>
        </div>
        <div>
          <dt>{t("paid")}</dt>
          <dd>
            <AnimatedMoney cents={paid} />
          </dd>
        </div>
        <div>
          <dt>{t("balance")}</dt>
          <dd>
            <AnimatedMoney cents={balance} />
          </dd>
        </div>
        <div>
          <dt>{t("paymentTerms")}</dt>
          <dd>{invoice.payment_terms || t("notSet")}</dd>
        </div>
        <div>
          <dt>{t("providerStatus")}</dt>
          <dd>
            {invoice.external_status
              ? t(`statuses.${invoice.external_status}`)
              : t("notSet")}
          </dd>
        </div>
      </dl>
      {invoice.order_id && (
        <Link className="text-link" href={`/orders/${invoice.order_id}`}>
          {t("openOrder")}
        </Link>
      )}
      {invoice.external_status === "paid" && balance > 0n && (
        <Alert tone="info" title={t("providerPaidHint")} />
      )}
      <section className="stack">
        <h2>{t("fiscalData")}</h2>
        <p>{t("fiscalHint")}</p>
        {supplier.success && customer.success ? (
          <dl className="details-grid">
            {[
              { party: supplier.data, label: t("supplier") },
              { party: customer.data, label: t("customer") },
            ].map(({ party, label }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="preserve-text">
                  {[
                    party.legal_name,
                    party.vat_number &&
                      t("vatNumberValue", { value: party.vat_number }),
                    party.tax_code &&
                      t("taxCodeValue", { value: party.tax_code }),
                    party.address.street,
                    [
                      party.address.postal_code,
                      party.address.city,
                      party.address.province,
                      party.address.country,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    party.sdi_code && t("sdiValue", { value: party.sdi_code }),
                    party.pec,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{t("legacyHint")}</p>
        )}
      </section>
      <section className="stack">
        <h2>{t("lines")}</h2>
        {lines.success ? (
          <DataTable
            caption={t("lines")}
            emptyMessage={t("emptyHint")}
            columns={[
              { key: "name", label: t("product") },
              { key: "variant", label: t("variant") },
              { key: "quantity", label: t("quantity"), numeric: true },
              { key: "net", label: t("net"), numeric: true },
              { key: "vat", label: t("vat"), numeric: true },
            ]}
            rows={lines.data.map((line, index) => ({
              id: String(index),
              name: line.name,
              variant: line.variant,
              quantity: line.quantity,
              net: formatMoney(line.net_cents),
              vat: formatMoney(line.vat_cents),
            }))}
          />
        ) : (
          <p>{t("legacyHint")}</p>
        )}
      </section>
      <section className="stack">
        <h2>{t("payments")}</h2>
        <DataTable
          caption={t("payments")}
          emptyMessage={t("noPayments")}
          columns={[
            { key: "date", label: t("paidDate") },
            { key: "amount", label: t("amount"), numeric: true },
            { key: "method", label: t("method") },
            { key: "note", label: t("note") },
          ]}
          rows={[...invoice.payments]
            .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
            .map((p) => ({
              id: p.id,
              date: new Intl.DateTimeFormat("it-IT", {
                timeZone: "Europe/Rome",
              }).format(new Date(p.paid_at)),
              amount: formatMoney(p.amount_cents),
              method: t(`methods.${p.method}`),
              note: p.note,
            }))}
        />
      </section>
      {user.role !== "staff" && (
        <InvoiceControls
          id={id}
          status={invoice.status}
          balance={balance.toString()}
          today={today}
          externalId={!!invoice.external_id}
          canCancel={
            !!invoice.external_id &&
            ["draft", "issued", "sent"].includes(invoice.status) &&
            invoice.payments.length === 0 &&
            invoice.external_status !== "paid"
          }
          canRetry={
            invoice.status === "draft" &&
            invoice.processing_status !== "completed"
          }
        />
      )}
    </>
  );
}
