import { getTranslations } from "next-intl/server";
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  return (
    <header className="stack">
      <h1>{t("title")}</h1>
      <p>{t("description")}</p>
    </header>
  );
}
