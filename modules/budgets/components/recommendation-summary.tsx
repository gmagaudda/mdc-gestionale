"use client";
import { useTranslations } from "next-intl";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { DataTable } from "@/components/shared/data-table";
import { formatMoney } from "@/lib/money";
import type { BudgetRecommendation } from "../recommendation-schema";
export function RecommendationSummary({
  snapshot,
}: {
  snapshot: BudgetRecommendation;
}) {
  const t = useTranslations("budgetRecommendation");
  const recent = snapshot.rows.filter(
    (r, index) =>
      index < 6 ||
      r.state !== "missing" ||
      r.reason ||
      r.operational_cents !== null ||
      r.historical_cents !== null,
  );
  const older = snapshot.rows.filter((r) => !recent.includes(r));
  const table = (rows: BudgetRecommendation["rows"], caption: string) => (
    <DataTable
      caption={caption}
      emptyMessage={t("noHistory")}
      columns={[
        { key: "code", label: t("season") },
        { key: "amount", label: t("spend"), numeric: true },
        { key: "state", label: t("state") },
        { key: "source", label: t("source") },
        { key: "weight", label: t("weight") },
      ]}
      rows={rows.map((r) => ({
        id: r.code,
        code: r.code,
        amount:
          r.amount_cents === null
            ? t("missingValue")
            : formatMoney(BigInt(r.amount_cents)),
        state: t(`states.${r.state}`),
        source: t(`sources.${r.source}`),
        weight: r.used
          ? t("weightValue", {
              weight: r.weight,
              total: snapshot.rows.reduce((sum, row) => sum + row.weight, 0),
            })
          : t("notUsed"),
      }))}
    />
  );
  return (
    <div className="stack recommendation-summary">
      <dl className="details-grid">
        <div>
          <dt>{t("suggested", { season: snapshot.target })}</dt>
          <dd>
            {snapshot.suggested_cents === null ? (
              t("noSuggestion")
            ) : (
              <AnimatedMoney cents={BigInt(snapshot.suggested_cents)} />
            )}
          </dd>
        </div>
        <div>
          <dt>{t("profile")}</dt>
          <dd>{t(`profiles.${snapshot.profile}`)}</dd>
        </div>
        <div>
          <dt>{t("coverage")}</dt>
          <dd>
            {t("coverageValue", {
              seasons: snapshot.history_count,
              cycles: snapshot.paired_cycles,
            })}
          </dd>
        </div>
      </dl>
      <p>{t("method")}</p>
      {snapshot.historical_source && (
        <p className="wrap-value">
          {t("sourceIdentity", {
            brand: snapshot.historical_source.brand,
            customer: snapshot.historical_source.customer,
            city: snapshot.historical_source.city,
            batch: snapshot.historical_source.batch_id,
          })}
        </p>
      )}
      {table(recent, t("history"))}
      {older.length > 0 && (
        <details>
          <summary>{t("olderHistory")}</summary>
          {table(older, t("olderHistory"))}
        </details>
      )}
    </div>
  );
}
