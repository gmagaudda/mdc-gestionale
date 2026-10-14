"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ListToolbar } from "@/components/shared/list-toolbar";
import type { PerformanceFilters, PerformanceReport } from "../report-schema";
export function PerformanceFiltersForm({
  initial,
  report,
  children,
}: {
  initial: PerformanceFilters;
  report: PerformanceReport;
  children?: ReactNode;
}) {
  const t = useTranslations("imports");
  const fields = [
    ["brand", "brands"],
    ["area", "areas"],
    ["representative", "representatives"],
    ["country", "countries"],
    ["region", "regions"],
  ] as const;
  return (
    <ListToolbar
      base="/analysis"
      searchName="search"
      query={initial.search}
      parameters={Object.fromEntries(
        Object.entries(initial).map(([key, value]) => [key, String(value)]),
      )}
      filters={[
        {
          name: "scope",
          label: t("scope"),
          value: initial.scope,
          defaultValue: "pivot",
          options: [
            { value: "pivot", label: t("pivotScope") },
            { value: "all", label: t("allBrands") },
          ],
        },
        {
          name: "dimension",
          label: t("groupBy"),
          value: initial.dimension,
          defaultValue: "brand",
          options: [
            "brand",
            "area",
            "representative",
            "country",
            "region",
            "customer",
          ].map((value) => ({ value, label: t(`dimensions.${value}`) })),
        },
        ...fields.map(([field, choices]) => ({
          name: field,
          label: t(`dimensions.${field}`),
          value: initial[field],
          options: report.choices[choices].map((value) => ({
            value,
            label: value,
          })),
        })),
      ]}
    >
      {children}
    </ListToolbar>
  );
}
