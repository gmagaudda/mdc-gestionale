import { LoadError } from "@/components/shared/load-error";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserForm } from "@/modules/users/components/user-form";
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
        <LoadError title={t("loadError")} />
      ) : (
        <UserForm brands={brands.data ?? []} />
      )}
    </>
  );
}
