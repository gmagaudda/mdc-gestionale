import Link from "next/link";
import { getTranslations } from "next-intl/server";
export default async function PortalNotFound() {
  const t = await getTranslations("common");
  return (
    <>
      <h1>404</h1>
      <p>{t("notFound")}</p>
      <Link className="text-link" href="/portal/dashboard">
        {t("returnHome")}
      </Link>
    </>
  );
}
