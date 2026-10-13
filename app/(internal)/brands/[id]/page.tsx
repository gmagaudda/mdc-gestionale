import { LoadError } from "@/components/shared/load-error";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireBrandAccess } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getBrand } from "@/modules/brands/queries";
import { archiveBrand, archiveContact } from "@/modules/brands/actions";
import { ContactForm } from "@/modules/brands/components/contact-form";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Alert } from "@/components/arc/alert/alert";
import { BrandSummaryDownload } from "@/components/shared/brand-summary-download";
export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const user = await requireBrandAccess(id).catch((error) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  });
  const t = await getTranslations("brands");
  const { brand, contacts } = await getBrand(id);
  if (brand.error || !brand.data) notFound();
  const data = brand.data;
  const privateData = data.brand_private;
  const saved = (await searchParams).saved === "1";
  return (
    <>
      <header className="stack">
        <Link className="text-link" href="/brands">
          {t("back")}
        </Link>
        <h1>{data.name}</h1>
        {user.role === "admin" && (
          <Link className="text-link" href={`/brands/${id}/edit`}>
            {t("edit")}
          </Link>
        )}
      </header>
      <Alert open={saved} tone="success" title={t("saved")} />
      <BrandSummaryDownload href={`/api/pdf/brand-summary/${id}`} />
      <dl className="details-grid">
        <div>
          <dt>{t("legal_name")}</dt>
          <dd>{data.legal_name || t("none")}</dd>
        </div>
        {privateData &&
          (
            [
              "vat_number",
              "tax_code",
              "address",
              "city",
              "country",
              "commission_pct",
              "notes",
            ] as const
          ).map((key) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>
                {key === "commission_pct"
                  ? new Intl.NumberFormat("it-IT", {
                      maximumFractionDigits: 2,
                    }).format(privateData[key])
                  : String(privateData[key] || t("none"))}
                {key === "commission_pct" ? "%" : ""}
              </dd>
            </div>
          ))}
        <div>
          <dt>{t("visibility")}</dt>
          <dd>
            {t(data.can_see_customer_names ? "visibilityYes" : "visibilityNo")}
          </dd>
        </div>
      </dl>
      <section className="stack" aria-labelledby="contacts-title">
        <h2 id="contacts-title">{t("contacts")}</h2>
        {contacts.error ? (
          <LoadError title={t("loadError")} />
        ) : contacts.data?.length ? (
          contacts.data.map((contact) => (
            <article className="stack contact-row" key={contact.id}>
              <h3>{contact.name}</h3>
              <p className="wrap-value">
                {[contact.role_title, contact.email, contact.phone]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {user.role === "admin" && (
                <>
                  <details>
                    <summary className="text-link">{t("editContact")}</summary>
                    <ContactForm
                      brandId={id}
                      id={contact.id}
                      initial={contact}
                    />
                  </details>
                  <ConfirmAction
                    label={t("archiveContact")}
                    question={t("archiveContactQuestion", {
                      name: contact.name,
                    })}
                    action={archiveContact.bind(null, contact.id, id)}
                  />
                </>
              )}
            </article>
          ))
        ) : (
          <p>{t("noContacts")}</p>
        )}
        {user.role === "admin" && (
          <details>
            <summary className="text-link">{t("addContact")}</summary>
            <ContactForm brandId={id} />
          </details>
        )}
      </section>
      {user.role === "admin" && (
        <ConfirmAction
          label={t("archive")}
          question={t("archiveQuestion", { name: data.name })}
          action={archiveBrand.bind(null, id)}
          destination="/brands"
        />
      )}
    </>
  );
}
