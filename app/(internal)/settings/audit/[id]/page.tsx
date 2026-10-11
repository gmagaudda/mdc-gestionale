import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { uuid } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export default async function AuditDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const client = await createClient();
  const { data, error } = await client
    .from("audit_log")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) notFound();
  const t = await getTranslations("audit");
  return (
    <>
      <h1>{t("detailTitle")}</h1>
      <p className="wrap-value">
        {t.has(`actions.${data.action}`)
          ? t(`actions.${data.action}`)
          : data.action}{" "}
        ·{" "}
        {t.has(`resources.${data.table_name}`)
          ? t(`resources.${data.table_name}`)
          : data.table_name}{" "}
        · {data.record_id}
      </p>
      <section className="stack">
        <h2>{t("before")}</h2>
        <pre className="audit-json">{JSON.stringify(data.before, null, 2)}</pre>
      </section>
      <section className="stack">
        <h2>{t("after")}</h2>
        <pre className="audit-json">{JSON.stringify(data.after, null, 2)}</pre>
      </section>
    </>
  );
}
