"use client";
import { useTranslations } from "next-intl";
import { TableFilter } from "@/components/shared/table-filter";
import { orderStatuses } from "../schema";
import type { OrderFilters as Filters } from "../filters";
import { searchOrderCustomers } from "../actions";
import type { ListQuery } from "@/lib/queries/list";
export function OrderFilters({
  initial,
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
  return (
    <>
      <TableFilter
        base="/orders"
        name="status"
        label={t("status")}
        value={initial.status}
        options={orderStatuses.map((value) => ({
          value,
          label: t(`statuses.${value}`),
        }))}
      />
      <TableFilter
        base="/orders"
        name="brand_id"
        label={t("brand")}
        value={initial.brand_id}
        clearKeys={["season_id"]}
        options={brands.map((row) => ({ value: row.id, label: row.name }))}
      />
      <TableFilter
        base="/orders"
        name="season_id"
        label={t("season")}
        value={initial.season_id}
        options={seasons
          .filter(
            (row) => !initial.brand_id || row.brand_id === initial.brand_id,
          )
          .map((row) => ({ value: row.id, label: row.code }))}
      />
      <TableFilter
        base="/orders"
        name="customer_id"
        label={t("customer")}
        value={initial.customer_id}
        options={customers.map((row) => ({
          value: row.id,
          label: row.legal_name,
        }))}
        loadOptions={searchOrderCustomers}
      />
    </>
  );
}
