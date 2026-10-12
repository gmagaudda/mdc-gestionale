import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Alert } from "@/components/arc/alert/alert";
import { getImportProfiles } from "@/modules/imports/profile-queries";
import { OperationalImport } from "@/modules/imports/components/operational-import";
export default async function OperationalImportPage() {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role)) notFound();
  const t = await getTranslations("imports"),
    result = await getImportProfiles();
  return (
    <>
      <PageHeader title={t("operational")} description={t("operationalHint")} />
      {/* File download must use native navigation, not the RSC router. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="text-link" href="/api/imports/template">
        {t("template")}
      </a>
      {!result.ok ? (
        <LoadError title={t("profilesLoadError")} />
      ) : (
        <>
          {result.invalidProfiles > 0 && (
            <Alert
              tone="warning"
              title={t("invalidProfiles", { count: result.invalidProfiles })}
            />
          )}
          <OperationalImport
            allowedEntities={
              user.role === "accounting"
                ? ["budgets"]
                : ["customers", "orders", "budgets"]
            }
            profiles={result.profiles}
          />
        </>
      )}
    </>
  );
}
