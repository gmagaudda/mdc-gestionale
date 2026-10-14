import { getTranslations } from "next-intl/server";
import type { TableFilterField } from "@/components/shared/table-filter-toolbar";
import { orderStatuses } from "../schema";
import type { OrderFilters as Filters } from "../filters";
import { searchOrderCustomers } from "../actions";
export async function getOrderFilterFields({
  initial,
  brands,
  seasons,
  customers,
}: {
  initial: Filters;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; code: string; name: string }[];
  customers: { id: string; legal_name: string; city: string }[];
}) {
  const t = await getTranslations("orders");
  return [
    {
      name: "status",
      label: t("status"),
      value: initial.status,
      options: orderStatuses.map((value) => ({
        value,
        label: t(`statuses.${value}`),
      })),
    },
    {
      name: "brand_id",
      label: t("brand"),
      value: initial.brand_id,
      clearKeys: ["season_id"],
      options: brands.map((row) => ({ value: row.id, label: row.name })),
    },
    {
      name: "season_id",
      label: t("season"),
      value: initial.season_id,
      options: seasons
        .filter((row) => !initial.brand_id || row.brand_id === initial.brand_id)
        .map((row) => ({ value: row.id, label: row.code })),
    },
    {
      name: "customer_id",
      label: t("customer"),
      value: initial.customer_id,
      options: customers.map((row) => ({
        value: row.id,
        label: row.legal_name,
      })),
      loadOptions: searchOrderCustomers,
    },
  ] satisfies TableFilterField[];
}
