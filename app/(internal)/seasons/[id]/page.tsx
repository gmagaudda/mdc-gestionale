import Link from "next/link";
import { notFound } from "next/navigation";
import { uuid } from "zod";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getSeason } from "@/modules/seasons/queries";
import { archiveSeason } from "@/modules/seasons/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Alert } from "@/components/arc/alert/alert";
export default async function SeasonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireRole(internalRoles);
  const { id } = await params;
  if (!uuid().safeParse(id).success) notFound();
  const { data } = await getSeason(id);
  if (!data) notFound();
  const t = await getTranslations("catalog");
  return (
    <>
      <Link href="/seasons" className="text-link">
        {t("allSeasons")}
      </Link>
      <h1>
        {data.code}: {data.name}
      </h1>
      {(await searchParams).saved === "1" && (
        <Alert tone="success" title={t("saved")} />
      )}
      {user.role !== "accounting" && (
        <Link className="text-link" href={`/seasons/${id}/edit`}>
          {t("editSeason")}
        </Link>
      )}
      <dl className="details-grid">
        <div>
          <dt>{t("brand")}</dt>
          <dd>{data.brands?.name}</dd>
        </div>
        {(
          [
            "campaign_start",
            "campaign_end",
            "delivery_start",
            "delivery_end",
          ] as const
        ).map((key) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>
              {data[key]
                ? new Intl.DateTimeFormat("it-IT", { timeZone: "UTC" }).format(
                    new Date(`${data[key]}T12:00:00Z`),
                  )
                : t("none")}
            </dd>
          </div>
        ))}
      </dl>
      {user.role !== "accounting" && (
        <ConfirmAction
          label={t("archiveSeason")}
          question={t("archiveSeasonQuestion")}
          action={archiveSeason.bind(null, id)}
          destination="/seasons"
        />
      )}
    </>
  );
}
