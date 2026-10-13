"use client";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { NativeSelectField } from "@/components/shared/native-select-field";
import { SearchSelect } from "@/components/shared/search-select";
import {
  recommendationSettingsSchema,
  historicalSourceSchema,
  profiles,
  type RecommendationSettings,
  type BudgetRecommendation,
} from "../recommendation-schema";
import {
  calculateBudgetRecommendation,
  searchHistoricalBudgetSources,
} from "../recommendation-actions";
import { formatMoney } from "@/lib/money";
import { RecommendationSummary } from "./recommendation-summary";
export type AcceptedRecommendation = {
  settings: RecommendationSettings;
  snapshot: BudgetRecommendation;
};
export function BudgetRecommendationPanel({
  brandId,
  seasonId,
  customerId,
  disabled,
  onAccept,
  onInvalidate,
}: {
  brandId: string;
  seasonId: string;
  customerId: string;
  disabled: boolean;
  onAccept: (value: AcceptedRecommendation) => void;
  onInvalidate: () => void;
}) {
  const t = useTranslations("budgetRecommendation");
  const region = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<RecommendationSettings>({
    brand_id: brandId,
    season_id: seasonId,
    customer_id: customerId,
    weights: [50, 30, 20],
    growth_bps: 0,
    seasonal_threshold: 20,
    profile: "auto",
    profile_reason: "",
    historical_source: null,
    overrides: [],
  });
  const [snapshot, setSnapshot] = useState<BudgetRecommendation | null>(null);
  const [status, setStatus] = useState<"stale" | "ready" | "accepted">("stale");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const update = (next: RecommendationSettings) => {
    setSettings(next);
    setStatus("stale");
    onInvalidate();
    setFields({});
    setError("");
  };
  const override = (
    code: string,
    patch: Partial<RecommendationSettings["overrides"][number]>,
  ) => {
    const previous = settings.overrides.find((r) => r.code === code) ?? {
      code,
      source: "auto" as const,
      state: "default" as const,
      reason: "",
    };
    update({
      ...settings,
      overrides: [
        ...settings.overrides.filter((r) => r.code !== code),
        { ...previous, ...patch },
      ],
    });
  };
  return (
    <section
      className="stack budget-recommendation"
      aria-labelledby="budget-recommendation-title"
      ref={region}
      aria-busy={pending}
    >
      <h2 id="budget-recommendation-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      <Alert open={!!error} title={t("reviewTitle")} tone="danger">
        <span className="wrap-value">{error}</span>
      </Alert>
      <details className="list-column-filters">
        <summary>{t("settings")}</summary>
        <fieldset className="form-grid" disabled={pending || disabled}>
          <legend className="sr-only">{t("settings")}</legend>
          {settings.weights.map((v, i) => (
            <Input
              key={i}
              type="number"
              min={1}
              max={1000}
              step={1}
              label={t("weightLabel", { position: i + 1 })}
              value={String(v)}
              error={fields.weights}
              onChange={(e) => {
                const w = [
                  ...settings.weights,
                ] as RecommendationSettings["weights"];
                w[i] = e.target.value === "" ? NaN : Number(e.target.value);
                update({ ...settings, weights: w });
              }}
            />
          ))}
          <Input
            label={t("growth")}
            type="number"
            min={-100}
            max={100}
            step="0.01"
            value={
              Number.isFinite(settings.growth_bps)
                ? String(settings.growth_bps / 100)
                : ""
            }
            error={fields.growth_bps}
            onChange={(e) =>
              update({
                ...settings,
                growth_bps:
                  e.target.value === ""
                    ? NaN
                    : Math.round(Number(e.target.value) * 100),
              })
            }
            description={t("growthHint")}
          />
          <Input
            label={t("threshold")}
            type="number"
            min={1}
            max={50}
            step={1}
            value={String(settings.seasonal_threshold)}
            error={fields.seasonal_threshold}
            onChange={(e) =>
              update({
                ...settings,
                seasonal_threshold:
                  e.target.value === "" ? NaN : Number(e.target.value),
              })
            }
            description={t("thresholdHint")}
          />
          <NativeSelectField
            label={t("profileOverride")}
            value={settings.profile}
            options={profiles.map((value) => ({
              value,
              label: t(`profiles.${value}`),
            }))}
            placeholder={t("choose")}
            error={fields.profile}
            onValueChange={(v) =>
              update({
                ...settings,
                profile: v as RecommendationSettings["profile"],
              })
            }
          />
          {settings.profile !== "auto" && (
            <Input
              label={t("profileReason")}
              value={settings.profile_reason}
              maxLength={500}
              error={fields.profile_reason}
              onChange={(e) =>
                update({ ...settings, profile_reason: e.target.value })
              }
            />
          )}
          <SearchSelect
            label={t("historicalSource")}
            value={
              settings.historical_source
                ? JSON.stringify(settings.historical_source)
                : "auto"
            }
            options={[{ value: "auto", label: t("automaticMatch") }]}
            loadOptions={async (term) => {
              const result = await searchHistoricalBudgetSources(term);
              return result.ok
                ? {
                    ok: true,
                    data: [
                      { value: "auto", label: t("automaticMatch") },
                      ...result.data,
                    ],
                  }
                : result;
            }}
            onValueChange={(v) => {
              if (v === "auto")
                update({ ...settings, historical_source: null });
              else {
                try {
                  const parsed = historicalSourceSchema.safeParse(
                    JSON.parse(v),
                  );
                  if (parsed.success)
                    update({ ...settings, historical_source: parsed.data });
                } catch {
                  setError(t("validation"));
                }
              }
            }}
          />
        </fieldset>
        <p>{t("sourceHint")}</p>
      </details>
      <div className="report-actions">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          loading={pending}
          disabled={disabled}
          onClick={() => {
            setError("");
            onInvalidate();
            setStatus("stale");
            const parsed = recommendationSettingsSchema.safeParse(settings);
            if (!parsed.success) {
              setFields(
                Object.fromEntries(
                  parsed.error.issues.map((i) => [
                    String(i.path[0]),
                    t(
                      i.message === "reasonRequired"
                        ? "reasonRequired"
                        : "validation",
                    ),
                  ]),
                ),
              );
              setError(t("validation"));
              requestAnimationFrame(() => {
                const input = region.current?.querySelector<HTMLElement>(
                  '[aria-invalid="true"]',
                );
                for (
                  let node = input?.parentElement;
                  node && node !== region.current;
                  node = node.parentElement
                )
                  if (node instanceof HTMLDetailsElement) node.open = true;
                input?.focus();
              });
              return;
            }
            start(async () => {
              try {
                const result = await calculateBudgetRecommendation(parsed.data);
                if (!result.ok) setError(t(result.error));
                else {
                  setSnapshot(result.data);
                  setStatus("ready");
                  setFields({});
                }
              } catch {
                setError(t("calculateError"));
              }
            });
          }}
        >
          <span className="list-button-copy">
            {t(snapshot ? "recalculate" : "calculate")}
          </span>
        </Button>
      </div>
      {pending && <Skeleton lines={4} label={t("loading")} />}
      {snapshot ? (
        <>
          <RecommendationSummary snapshot={snapshot} />
          {snapshot.historical_match === "ambiguous" && (
            <Alert title={t("reviewTitle")} tone="warning">
              <span className="wrap-value">{t("ambiguous")}</span>
            </Alert>
          )}
          {status === "stale" && (
            <Alert title={t("reviewTitle")}>
              <span className="wrap-value">{t("stalePreview")}</span>
            </Alert>
          )}
          {snapshot.suggested_cents === null && (
            <EmptyState
              title={t("noHistory")}
              description={t("noHistoryHint")}
            />
          )}
          <details className="list-column-filters">
            <summary>{t("reviewSeasons")}</summary>
            <p>{t("reviewHint")}</p>
            {snapshot.rows.map((row) => {
              const ov = settings.overrides.find((r) => r.code === row.code);
              return (
                <details key={row.code} className="list-column-filters">
                  <summary>{t("reviewSeason", { season: row.code })}</summary>
                  <fieldset
                    className="form-grid"
                    disabled={pending || disabled}
                  >
                    <legend className="sr-only">
                      {t("reviewSeason", { season: row.code })}
                    </legend>
                    <NativeSelectField
                      label={t("stateLabel", { season: row.code })}
                      value={ov?.state ?? "default"}
                      placeholder={t("choose")}
                      options={[
                        "default",
                        "closed",
                        "zero",
                        "missing",
                        "excluded",
                      ].map((value) => ({
                        value,
                        label: t(`overrides.${value}`),
                      }))}
                      onValueChange={(v) =>
                        override(row.code, {
                          state:
                            v as RecommendationSettings["overrides"][number]["state"],
                        })
                      }
                    />
                    <NativeSelectField
                      label={t("sourceLabel", { season: row.code })}
                      value={ov?.source ?? "auto"}
                      placeholder={t("choose")}
                      options={[
                        { value: "auto", label: t("automaticSource") },
                        ...(["operational", "historical"] as const).map(
                          (value) => {
                            const cents =
                              value === "operational"
                                ? row.operational_cents
                                : row.historical_cents;
                            return {
                              value,
                              label: t("sourceAmount", {
                                source: t(`sources.${value}`),
                                amount:
                                  cents === null
                                    ? t("missingValue")
                                    : formatMoney(BigInt(cents)),
                              }),
                            };
                          },
                        ),
                      ]}
                      onValueChange={(v) =>
                        override(row.code, {
                          source:
                            v as RecommendationSettings["overrides"][number]["source"],
                        })
                      }
                    />
                    <Input
                      label={t("reasonLabel", { season: row.code })}
                      value={ov?.reason ?? ""}
                      maxLength={500}
                      error={fields.overrides}
                      onChange={(e) =>
                        override(row.code, { reason: e.target.value })
                      }
                    />
                  </fieldset>
                </details>
              );
            })}
          </details>
          <div className="report-actions">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={
                status !== "ready" ||
                snapshot.suggested_cents === null ||
                disabled
              }
              onClick={() => {
                onAccept({ settings, snapshot });
                setStatus("accepted");
              }}
            >
              <span className="list-button-copy">{t("use")}</span>
            </Button>
          </div>
          <div role="status">{status === "accepted" ? t("accepted") : ""}</div>
        </>
      ) : !pending ? (
        <EmptyState title={t("ready")} description={t("readyHint")} />
      ) : null}
    </section>
  );
}
