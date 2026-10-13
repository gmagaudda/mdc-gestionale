"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SearchSelect } from "@/components/shared/search-select";
import { SelectField } from "@/components/shared/select-field";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { orderStatuses } from "../schema";
import type { OrderFilters as Filters } from "../filters";
import { searchOrderCustomers } from "../actions";
import { columnFilterParams, type ListQuery } from "@/lib/queries/list";
export function OrderFilters({
  initial,
  query,
  brands,
  seasons,
  customers,
}: {
  initial: Filters;
  query: ListQuery;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; code: string; name: string }[];
  customers: { id: string; legal_name: string; city: string }[];
}) {
  const t = useTranslations("orders");
  const [filters, setFilters] = useState(initial);
  return (
    <form action="/orders" className="stack">
      <div className="form-grid">
        {Object.entries({
          ...columnFilterParams(query.columnFilters),
          q: query.q,
          sort: query.sort,
          direction: query.direction,
        }).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <SelectField
          label={t("status")}
          value={filters.status || "all"}
          options={[
            { value: "all", label: t("allStatuses") },
            ...orderStatuses.map((value) => ({
              value,
              label: t(`statuses.${value}`),
            })),
          ]}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              status: value === "all" ? "" : (value as Filters["status"]),
            }))
          }
        />
        <SearchSelect
          label={t("brand")}
          value={filters.brand_id}
          options={brands.map((row) => ({ value: row.id, label: row.name }))}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              brand_id: value,
              season_id: "",
            }))
          }
        />
        <SearchSelect
          label={t("season")}
          value={filters.season_id}
          options={seasons
            .filter(
              (row) => !filters.brand_id || row.brand_id === filters.brand_id,
            )
            .map((row) => ({
              value: row.id,
              label: `${row.code}: ${row.name}`,
            }))}
          onValueChange={(value) =>
            setFilters((current) => ({ ...current, season_id: value }))
          }
        />
        <SearchSelect
          label={t("customer")}
          value={filters.customer_id}
          options={customers.map((row) => ({
            value: row.id,
            label: row.legal_name,
          }))}
          loadOptions={searchOrderCustomers}
          onValueChange={(value) =>
            setFilters((current) => ({ ...current, customer_id: value }))
          }
        />
        <Input
          label={t("from")}
          name="from"
          type="date"
          defaultValue={initial.from}
        />
        <Input
          label={t("to")}
          name="to"
          type="date"
          defaultValue={initial.to}
        />
      </div>
      {["status", "brand_id", "season_id", "customer_id"].map((key) => (
        <input
          key={key}
          type="hidden"
          name={key}
          value={filters[key as keyof Filters]}
        />
      ))}
      <div className="list-sort">
        <Button type="submit" size="lg" variant="secondary">
          {t("applyFilters")}
        </Button>
        <Link className="text-link" href="/orders">
          {t("clearFilters")}
        </Link>
      </div>
    </form>
  );
}
