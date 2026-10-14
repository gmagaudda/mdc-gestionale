import { getTranslations } from "next-intl/server";
import type { TableFilterField } from "@/components/shared/table-filter-toolbar";
import type { DashboardFilters } from "@/modules/dashboard/schema";
import { orderStatuses } from "@/modules/orders/schema";
export async function getPortalFilterFields({
  initial,
  brands,
  seasons,
  status,
}: {
  initial: DashboardFilters;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; code: string; name: string }[];
  status?: "" | (typeof orderStatuses)[number];
}): Promise<TableFilterField[]> {
  const t = await getTranslations("portal");
  return [
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
    ...(status !== undefined
      ? [
          {
            name: "status",
            label: t("status"),
            value: status,
            options: orderStatuses.map((value) => ({
              value,
              label: t(`statuses.${value}`),
            })),
          },
        ]
      : []),
  ];
}
