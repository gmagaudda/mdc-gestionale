"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { Select } from "@/components/arc/select/select";
import { SearchSelect } from "@/components/shared/search-select";
import { TableFilter } from "@/components/shared/table-filter";
import { Alert } from "@/components/arc/alert/alert";
import { portalFiltersSchema } from "../schema";
import { orderStatuses } from "@/modules/orders/schema";
import type { DashboardFilters } from "@/modules/dashboard/schema";
function ChoiceField(props: React.ComponentProps<typeof Select>) {
  return props.options.length <= 12 ? (
    <Select {...props} />
  ) : (
    <SearchSelect
      label={props.label}
      value={props.value ?? "all"}
      options={props.options}
      disabled={props.disabled}
      onValueChange={props.onValueChange ?? (() => {})}
    />
  );
}
export function PortalFilters({
  initial,
  brands,
  seasons,
  base = "/portal/dashboard",
  status,
}: {
  initial: DashboardFilters;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; code: string; name: string }[];
  base?: "/portal/dashboard" | "/portal/sales" | "/portal/orders";
  status?: "" | (typeof orderStatuses)[number];
}) {
  const t = useTranslations("portal"),
    router = useRouter(),
    [value, setValue] = useState({ ...initial, status: status ?? "" }),
    [pending, start] = useTransition(),
    [error, setError] = useState(false);
  const key = JSON.stringify({ ...initial, status }),
    [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setValue({ ...initial, status: status ?? "" });
  }
  if (base !== "/portal/dashboard")
    return (
      <>
        <TableFilter
          base={base}
          name="brand_id"
          label={t("brand")}
          value={initial.brand_id}
          clearKeys={["season_id"]}
          options={brands.map((b) => ({ value: b.id, label: b.name }))}
        />
        <TableFilter
          base={base}
          name="season_id"
          label={t("season")}
          value={initial.season_id}
          options={seasons
            .filter((s) => !initial.brand_id || s.brand_id === initial.brand_id)
            .map((s) => ({ value: s.id, label: s.code }))}
        />
        {base === "/portal/orders" && (
          <TableFilter
            base={base}
            name="status"
            label={t("status")}
            value={status}
            options={orderStatuses.map((s) => ({
              value: s,
              label: t(`statuses.${s}`),
            }))}
          />
        )}
      </>
    );
  const all = { value: "all", label: t("all") };
  return (
    <form
      className="stack"
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (!portalFiltersSchema.safeParse(value).success) {
          setError(true);
          return;
        }
        setError(false);
        start(() =>
          router.push(
            `${base}?${new URLSearchParams(Object.entries(value).filter(([, v]) => !!v))}`,
          ),
        );
      }}
    >
      <fieldset className="form-grid" disabled={pending}>
        <legend className="sr-only">{t("filters")}</legend>
        <ChoiceField
          label={t("brand")}
          placeholder={t("all")}
          disabled={pending}
          value={value.brand_id || "all"}
          options={[
            all,
            ...brands.map((b) => ({ value: b.id, label: b.name })),
          ]}
          onValueChange={(id) =>
            setValue((v) => ({
              ...v,
              brand_id: id === "all" ? "" : id,
              season_id: "",
            }))
          }
        />
        {value.brand_id && (
          <ChoiceField
            label={t("season")}
            placeholder={t("all")}
            disabled={pending}
            value={value.season_id || "all"}
            options={[
              all,
              ...seasons
                .filter((s) => s.brand_id === value.brand_id)
                .map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` })),
            ]}
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
      <div className="form-actions report-actions">
        <Button variant="secondary" type="submit" size="lg" loading={pending}>
          {t("apply")}
        </Button>
        <Button
          variant="ghost"
          type="button"
          size="lg"
          onClick={() => {
            setValue({ ...portalFiltersSchema.parse({}), status: "" });
            start(() => router.push(base));
          }}
        >
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}
