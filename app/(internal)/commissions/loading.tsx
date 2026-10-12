import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
export default async function Loading() {
  const t = await getTranslations("commissions");
  return (
    <>
      <h1>{t("title")}</h1>
      <Skeleton lines={4} />
      <Skeleton lines={3} />
      <Skeleton lines={8} />
    </>
  );
}
