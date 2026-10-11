import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AuthForm } from "@/modules/auth/components/auth-form";
export default async function InvitePage() {
  if ((await cookies()).get("auth-flow")?.value !== "invite")
    redirect("/reset-password?error=expired");
  const t = await getTranslations("auth");
  return (
    <>
      <header className="stack">
        <h1>{t("inviteTitle")}</h1>
        <p>{t("passwordRules")}</p>
      </header>
      <AuthForm mode="password" />
    </>
  );
}
