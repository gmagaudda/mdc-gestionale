import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/modules/auth/components/auth-form";
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations("auth");
  const query = await searchParams;
  const updating =
    query.mode === "new" &&
    (await cookies()).get("auth-flow")?.value === "recovery";
  return (
    <>
      <header className="stack">
        <h1>{t(updating ? "newPassword" : "resetTitle")}</h1>
        <p>{t(updating ? "passwordRules" : "resetDescription")}</p>
      </header>
      <AuthForm
        mode={updating ? "password" : "reset"}
        initialError={
          query.error === "expired" || (query.mode === "new" && !updating)
            ? "expired"
            : undefined
        }
      />
      <Link className="text-link" href="/login">
        {t("backToLogin")}
      </Link>
    </>
  );
}
