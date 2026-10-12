import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getDocument } from "@/modules/documents/queries";
import { archiveDocument } from "@/modules/documents/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Alert } from "@/components/arc/alert/alert";
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireRole(internalRoles),
    { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data } = await getDocument(id);
  if (!data) notFound();
  const t = await getTranslations("documents");
  return (
    <>
      <Link className="text-link" href="/documents">
        {t("all")}
      </Link>
      <h1>{data.name}</h1>
      {(await searchParams).saved === "1" && (
        <Alert tone="success" title={t("saved")} />
      )}
      <a className="text-link" href={`/api/documents/${id}/download`}>
        {t("download")}
      </a>
      <p className="text-secondary">{t("downloadHint")}</p>
      {user.role !== "accounting" && (
        <Link className="text-link" href={`/documents/${id}/edit`}>
          {t("edit")}
        </Link>
      )}
      <dl className="details-grid">
        <div>
          <dt>{t("kind")}</dt>
          <dd>{t(`kinds.${data.kind}`)}</dd>
        </div>
        <div>
          <dt>{t("brand")}</dt>
          <dd>{data.brands?.name}</dd>
        </div>
        <div>
          <dt>{t("visibility")}</dt>
          <dd>{t(data.shared_with_brand ? "sharedState" : "internalState")}</dd>
        </div>
        <div>
          <dt>{t("file")}</dt>
          <dd>{data.original_filename}</dd>
        </div>
        {data.customers && (
          <div>
            <dt>{t("customer")}</dt>
            <dd>{data.customers.legal_name}</dd>
          </div>
        )}
        {data.orders && (
          <div>
            <dt>{t("order")}</dt>
            <dd>{data.orders.number}</dd>
          </div>
        )}
      </dl>
      {user.role !== "accounting" && (
        <ConfirmAction
          label={t("archive")}
          question={t("archiveQuestion")}
          action={archiveDocument.bind(null, id)}
          destination="/documents"
        />
      )}
    </>
  );
}
