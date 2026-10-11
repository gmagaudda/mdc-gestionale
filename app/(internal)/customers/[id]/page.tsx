import Link from "next/link";
import { uuid } from "zod";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getCustomer } from "@/modules/customers/queries";
import { addressSchema } from "@/modules/customers/schema";
import {
  archiveCustomer,
  archiveCustomerContact,
} from "@/modules/customers/actions";
import { CustomerContactForm } from "@/modules/customers/components/contact-form";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Alert } from "@/components/arc/alert/alert";
export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(internalRoles);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const t = await getTranslations("customers");
  const { customer, contacts } = await getCustomer(id);
  if (!customer.data) notFound();
  const data = customer.data;
  const editable = user.role !== "accounting";
  return (
    <>
      <header className="stack">
        <Link className="text-link" href="/customers">
          {t("back")}
        </Link>
        <h1>{data.legal_name}</h1>
        {editable && (
          <Link className="text-link" href={`/customers/${id}/edit`}>
            {t("edit")}
          </Link>
        )}
      </header>
      <Alert
        open={(await searchParams).saved === "1"}
        tone="success"
        title={t("saved")}
      />
      <dl className="details-grid">
        {(
          [
            "trade_name",
            "vat_number",
            "tax_code",
            "sdi_code",
            "pec",
            "payment_terms",
            "notes",
          ] as const
        ).map((key) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{data[key] || t("none")}</dd>
          </div>
        ))}
        {(["billing_address", "shipping_address"] as const).map((key) => {
          const parsed = addressSchema.safeParse(data[key]);
          return (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>
                {parsed.success
                  ? Object.values(parsed.data).filter(Boolean).join(", ")
                  : t("none")}
              </dd>
            </div>
          );
        })}
      </dl>
      <section className="stack" aria-labelledby="customer-contacts">
        <h2 id="customer-contacts">{t("contacts")}</h2>
        {contacts.error ? (
          <Alert tone="danger" title={t("loadError")} />
        ) : contacts.data?.length ? (
          contacts.data.map((contact) => (
            <article className="stack contact-row" key={contact.id}>
              <h3>{contact.name}</h3>
              <p className="wrap-value">
                {[contact.role_title, contact.email, contact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {editable && (
                <>
                  <details>
                    <summary className="text-link">{t("editContact")}</summary>
                    <CustomerContactForm
                      customerId={id}
                      id={contact.id}
                      initial={contact}
                    />
                  </details>
                  <ConfirmAction
                    label={t("archiveContact")}
                    question={t("archiveContactQuestion", {
                      name: contact.name,
                    })}
                    action={archiveCustomerContact.bind(null, contact.id, id)}
                  />
                </>
              )}
            </article>
          ))
        ) : (
          <p>{t("noContacts")}</p>
        )}
        {editable && (
          <details>
            <summary className="text-link">{t("addContact")}</summary>
            <CustomerContactForm customerId={id} />
          </details>
        )}
      </section>
      {editable && (
        <ConfirmAction
          label={t("archive")}
          question={t("archiveQuestion", { name: data.legal_name })}
          action={archiveCustomer.bind(null, id)}
          destination="/customers"
        />
      )}
    </>
  );
}
