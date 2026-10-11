import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
export default async function Loading() {
  const t = await getTranslations("lists");
  return <Skeleton label={t("loading")} lines={5} />;
}
