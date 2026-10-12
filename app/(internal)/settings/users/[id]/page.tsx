import { LoadError } from "@/components/shared/load-error";
import { uuid } from "zod";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UserForm } from "@/modules/users/components/user-form";
import { Alert } from "@/components/arc/alert/alert";
export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const t = await getTranslations("users");
  const client = await createClient();
  const [profile, brands, memberships] = await Promise.all([
    client.from("profiles").select("*").eq("id", id).single(),
    client
      .from("brands")
      .select("id,name")
      .is("deleted_at", null)
      .order("name"),
    client.from("brand_users").select("brand_id").eq("user_id", id),
  ]);
  if (!profile.data) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <>
      <h1>{t("edit")}</h1>
      <Alert open={saved} tone="success" title={t("saved")} />
      {brands.error || memberships.error ? (
        <LoadError title={t("loadError")} />
      ) : (
        <UserForm
          id={id}
          initial={{
            ...profile.data,
            brand_ids: (memberships.data ?? []).map((row) => row.brand_id),
          }}
          brands={brands.data ?? []}
        />
      )}
    </>
  );
}
