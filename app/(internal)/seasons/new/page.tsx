import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { SeasonForm } from "@/modules/seasons/components/season-form";
import { catalogChoices } from "@/modules/seasons/queries";
export default async function NewSeasonPage() {
  await requireRole(["admin", "staff"]);
  const t = await getTranslations("catalog");
  const { brands } = await catalogChoices();
  return (
    <>
      <h1>{t("createSeason")}</h1>
      <SeasonForm brands={brands} />
    </>
  );
}
