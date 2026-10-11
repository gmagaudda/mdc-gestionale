import Link from "next/link";
import { getTranslations } from "next-intl/server";
export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="page-container stack">
      <h1>404</h1>
      <p>{t("notFound")}</p>
      <Link className="text-link" href="/">
        {t("returnHome")}
      </Link>
    </main>
  );
}
