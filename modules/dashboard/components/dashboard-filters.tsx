"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { SearchSelect, type Choice } from "@/components/shared/search-select";
import {
  searchBudgetBrands,
  searchBudgetSeasons,
} from "@/modules/budgets/actions";
import { dashboardFiltersSchema, type DashboardFilters } from "../schema";
export function DashboardFiltersForm({
  initial,
  brands,
  season,
}: {
  initial: DashboardFilters;
  brands: Choice[];
  season?: Choice;
}) {
  const t = useTranslations("dashboard"),
    router = useRouter(),
    [value, setValue] = useState(initial),
    [error, setError] = useState(false),
    [pending, start] = useTransition();
  const filterKey = JSON.stringify(initial);
  const [seenFilterKey, setSeenFilterKey] = useState(filterKey);
  if (seenFilterKey !== filterKey) {
    setSeenFilterKey(filterKey);
    setValue(initial);
  }
  const all = { value: "all", label: t("all") };
  return (
    <form
      className="stack"
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (!dashboardFiltersSchema.safeParse(value).success) {
          setError(true);
          return;
        }
        setError(false);
        const params = new URLSearchParams(
          Object.entries(value).filter(([, value]) => !!value),
        );
        start(() => router.push(`/dashboard?${params}`));
      }}
    >
      <fieldset className="form-grid" disabled={pending}>
        <legend className="sr-only">{t("filters")}</legend>
        <SearchSelect
          label={t("brand")}
          value={value.brand_id || "all"}
          options={[all, ...brands]}
          loadOptions={async (input) => {
            const r = await searchBudgetBrands(input);
            return r.ok ? { ok: true, data: [all, ...r.data] } : r;
          }}
          onValueChange={(id) =>
            setValue((v) => ({
              ...v,
              brand_id: id === "all" ? "" : id,
              season_id: "",
            }))
          }
        />
        {value.brand_id && (
          <SearchSelect
            key={value.brand_id}
            label={t("season")}
            value={value.season_id || "all"}
            options={[all, ...(season ? [season] : [])]}
            loadOptions={async (term) => {
              const r = await searchBudgetSeasons(value.brand_id, term);
              return r.ok ? { ok: true, data: [all, ...r.data] } : r;
            }}
            onValueChange={(id) =>
              setValue((v) => ({ ...v, season_id: id === "all" ? "" : id }))
            }
          />
        )}
        <Input
          label={t("from")}
          type="date"
          value={value.from}
          onChange={(e) => setValue((v) => ({ ...v, from: e.target.value }))}
        />
        <Input
          label={t("to")}
          type="date"
          value={value.to}
          onChange={(e) => setValue((v) => ({ ...v, to: e.target.value }))}
        />
      </fieldset>
      <Alert open={error} tone="danger" title={t("invalidFilters")} />
      <div className="form-actions">
        <Button type="submit" variant="secondary" size="lg" loading={pending}>
          {t("apply")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            setValue({ brand_id: "", season_id: "", from: "", to: "" });
            start(() => router.push("/dashboard"));
          }}
        >
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}
