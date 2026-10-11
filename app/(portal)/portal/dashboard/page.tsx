import { getTranslations } from "next-intl/server";
export default async function PortalDashboard() {
  const t = await getTranslations("dashboard");
  return (
    <header className="stack">
      <h1>{t("portalTitle")}</h1>
      <p>{t("portalDescription")}</p>
    </header>
  );
}
