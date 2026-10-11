import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getSeason, catalogChoices } from "@/modules/seasons/queries";
import { SeasonForm } from "@/modules/seasons/components/season-form";
export default async function EditSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "staff"]);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const [result, choices] = await Promise.all([
    getSeason(id),
    catalogChoices(),
  ]);
  const data = result.data;
  if (!data) notFound();
  const t = await getTranslations("catalog");
  return (
    <>
      <h1>{t("editSeason")}</h1>
      <SeasonForm
        id={id}
        brands={choices.brands}
        initial={{
          brand_id: data.brand_id,
          code: data.code,
          name: data.name,
          campaign_start: data.campaign_start ?? "",
          campaign_end: data.campaign_end ?? "",
          delivery_start: data.delivery_start ?? "",
          delivery_end: data.delivery_end ?? "",
        }}
      />
    </>
  );
}
