import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentForm } from "@/modules/documents/components/document-form";
import { documentBrands } from "@/modules/documents/queries";
export default async function NewDocumentPage() {
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("documents");
  return (
    <>
      <PageHeader title={t("upload")} />
      <DocumentForm brands={await documentBrands()} />
    </>
  );
}
