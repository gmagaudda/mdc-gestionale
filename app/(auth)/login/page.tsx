import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { homeForRole } from "@/lib/auth/roles";
import { AuthForm } from "@/modules/auth/components/auth-form";
import { Alert } from "@/components/arc/alert/alert";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getSessionUser();
  if (user) redirect(homeForRole(user.role));
  const t = await getTranslations("auth");
  const query = await searchParams;
  return (
    <>
      <header className="stack">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </header>
      {query.password === "updated" && (
        <Alert tone="success" title={t("passwordUpdated")} />
      )}
      <AuthForm mode="login" next={query.next} />
      <Link className="text-link" href="/reset-password">
        {t("forgotPassword")}
      </Link>
    </>
  );
}
