import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserForm } from "@/modules/users/components/user-form";
import { Alert } from "@/components/arc/alert/alert";
export default async function InvitePage() {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const t = await getTranslations("users");
  const client = await createClient();
  const brands = await client
    .from("brands")
    .select("id,name")
    .is("deleted_at", null)
    .order("name");
  return (
    <>
      <h1>{t("invite")}</h1>
      {brands.error ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : (
        <UserForm brands={brands.data ?? []} />
      )}
    </>
  );
}
