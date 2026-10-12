import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getDocument, documentBrands } from "@/modules/documents/queries";
import { DocumentForm } from "@/modules/documents/components/document-form";
import { PageHeader } from "@/components/shared/page-header";
export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data } = await getDocument(id);
  if (!data) notFound();
  const t = await getTranslations("documents"),
    brands = await documentBrands();
  if (!brands.some((b) => b.id === data.brand_id))
    brands.push({ id: data.brand_id, name: data.brands?.name ?? "" });
  return (
    <>
      <PageHeader title={t("edit")} />
      <DocumentForm
        brands={brands}
        existing={{
          id: data.id,
          updated_at: data.updated_at,
          name: data.name,
          kind: data.kind,
          brand_id: data.brand_id,
          customer_id: data.customer_id ?? "",
          order_id: data.order_id ?? "",
          shared_with_brand: data.shared_with_brand,
          customer_name: data.customers?.legal_name,
          order_number: data.orders?.number,
        }}
      />
    </>
  );
}
