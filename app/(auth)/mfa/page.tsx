import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, safeNext } from "@/lib/auth/roles";
import { MfaForm } from "@/modules/auth/components/mfa-form";
import { LoadError } from "@/components/shared/load-error";
import { LogoutForm } from "@/components/pwa/logout-form";
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = await createClient(),
    identity = await db.auth.getUser();
  if (identity.error || !identity.data.user) redirect("/login");
  const profile = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", identity.data.user.id)
    .single();
  if (!profile.data?.is_active) redirect("/login");
  if (profile.data.role !== "admin") redirect(homeForRole(profile.data.role));
  const level = await db.auth.mfa.getAuthenticatorAssuranceLevel(),
    query = await searchParams;
  if (level.data?.currentLevel === "aal2") redirect(safeNext(query.next));
  const t = await getTranslations("auth"),
    factors = await db.auth.mfa.listFactors();
  return (
    <>
      <header className="stack">
        <h1>{t("mfaTitle")}</h1>
        <p>{t("mfaHint")}</p>
        <p data-mfa-account>{identity.data.user.email}</p>
      </header>
      {factors.error || level.error ? (
        <LoadError title={t("unavailable")} />
      ) : (
        <MfaForm
          factorId={factors.data.totp.find((f) => f.status === "verified")?.id}
          next={query.next}
        />
      )}
      <p>{t("mfaRecoveryHint")}</p>
      <LogoutForm />
    </>
  );
}
