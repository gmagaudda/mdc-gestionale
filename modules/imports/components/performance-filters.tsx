"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NativeSelectField } from "@/components/shared/native-select-field";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import type { PerformanceFilters, PerformanceReport } from "../report-schema";
export function PerformanceFiltersForm({
  initial,
  report,
}: {
  initial: PerformanceFilters;
  report: PerformanceReport;
}) {
  const t = useTranslations("imports"),
    router = useRouter(),
    [state, setState] = useState(initial);
  const update = (key: keyof PerformanceFilters, value: string) =>
    setState((s) => ({ ...s, [key]: value }));
  const selects = [
    ["brand", "brands"],
    ["area", "areas"],
    ["representative", "representatives"],
    ["country", "countries"],
    ["region", "regions"],
  ] as const;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new URLSearchParams();
        for (const [key, value] of Object.entries({ ...state, page: 1 }))
          if (value !== "" && key !== "page") q.set(key, String(value));
        router.push(`/analysis?${q}`);
      }}
    >
      <fieldset className="form-grid">
        <legend>{t("filters")}</legend>
        <NativeSelectField
          label={t("scope")}
          value={state.scope}
          onValueChange={(v) => update("scope", v || "pivot")}
          options={[
            { value: "pivot", label: t("pivotScope") },
            { value: "all", label: t("allBrands") },
          ]}
          placeholder={t("pivotScope")}
        />
        <NativeSelectField
          label={t("groupBy")}
          value={state.dimension}
          onValueChange={(v) => update("dimension", v || "brand")}
          options={[
            "brand",
            "area",
            "representative",
            "country",
            "region",
            "customer",
          ].map((value) => ({ value, label: t(`dimensions.${value}`) }))}
          placeholder={t("dimensions.brand")}
        />
        {selects.map(([field, choices]) => (
          <NativeSelectField
            key={field}
            label={t(`dimensions.${field}`)}
            value={state[field]}
            onValueChange={(v) => update(field, v)}
            options={report.choices[choices].map((value) => ({
              value,
              label: value,
            }))}
            placeholder={t("all")}
          />
        ))}
        <Input
          label={t("search")}
          value={state.search}
          maxLength={100}
          onChange={(e) => update("search", e.target.value)}
        />
      </fieldset>
      <p>{t("brandScopeHint")}</p>
      <div className="form-actions report-actions">
        <Button size="lg" type="submit">
          {t("apply")}
        </Button>
      </div>
    </form>
  );
}
