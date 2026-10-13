import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { columnFilters } from "@/lib/queries/column-filters";
import { listExports, type ListExportEntity } from "@/lib/exports/lists";
import { listHref, type ListQuery } from "@/lib/queries/list";

export async function ListColumnFilters({
  entity,
  base,
  query,
  filterParams,
}: {
  entity: ListExportEntity;
  base: string;
  query: ListQuery;
  filterParams: Record<string, string>;
}) {
  const t = await getTranslations("lists");
  const labels = await getTranslations(listExports[entity].namespace);
  const active = Object.values(query.columnFilters ?? {}).some(
    (value) => value !== "",
  );
  return (
    <details className="workspace-filters" open={active || undefined}>
      <summary>{t("columnFilters")}</summary>
      <form action={base} className="stack">
        {Object.entries({
          ...filterParams,
          q: query.q,
          sort: query.sort,
          direction: query.direction,
        }).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <p>{t("columnFilterHint")}</p>
        <fieldset className="form-grid">
          <legend className="sr-only">{t("columnFilters")}</legend>
          {columnFilters[entity].map((field) => (
            <Input
              key={field.key}
              name={`cf_${field.key}`}
              label={t("columnFilterField", { field: labels(field.label) })}
              type={
                field.kind === "date"
                  ? "date"
                  : field.kind === "integer"
                    ? "number"
                    : field.kind === "text"
                      ? "search"
                      : "text"
              }
              inputMode={
                field.kind === "money"
                  ? "decimal"
                  : field.kind === "integer"
                    ? "numeric"
                    : undefined
              }
              maxLength={100}
              {...(field.kind === "integer"
                ? { min: 0, max: 10485760, step: 1 }
                : {})}
              defaultValue={
                typeof query.columnFilters?.[field.key] === "string"
                  ? (query.columnFilters[field.key] as string)
                  : ""
              }
            />
          ))}
        </fieldset>
        <div className="form-actions report-actions">
          <Button variant="secondary" type="submit" size="lg">
            <span className="list-button-copy">{t("applyColumnFilters")}</span>
          </Button>
          {active && (
            <Link
              className="text-link"
              href={listHref(
                base,
                query,
                { page: 1, columnFilters: undefined },
                filterParams,
              )}
            >
              {t("clearColumnFilters")}
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}
