"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
  useCallback,
} from "react";
import { useTranslations } from "next-intl";
import {
  FilterToolbar,
  type FilterChip,
} from "@/components/arc/filter-toolbar/filter-toolbar";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { SearchSelect, type Choice } from "./search-select";
import { ResponsiveDialog } from "./responsive-dialog";
import type { ActionResult } from "@/lib/errors";

export type TableFilterField = {
  name: string;
  label: string;
  value?: string;
  options: Choice[];
  loadOptions?: (term: string) => Promise<ActionResult<Choice[]>>;
  clearKeys?: string[];
  defaultValue?: string;
};

// PostgreSQL text cannot contain NUL, so this menu action cannot collide with a data value.
const searchValue = "\u0000search";
const chipValue = (value: string, limit = 12) => {
  const characters = Array.from(value);
  return characters.length > limit
    ? `${characters.slice(0, limit - 1).join("")}…`
    : value;
};

export function TableFilterToolbar({
  fields,
  onChange,
}: {
  fields: TableFilterField[];
  onChange: (changes: Record<string, string>) => void;
}) {
  const t = useTranslations("lists");
  const root = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"full" | "compact" | "tiny">("full");
  const compact = layout !== "full";
  const tiny = layout === "tiny";
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      setLayout(
        rem >= 24 && entry.contentRect.width < 20 * rem
          ? "tiny"
          : entry.contentRect.width < 40 * rem
            ? "compact"
            : "full",
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [remote, setRemote] = useState<Record<string, Choice[]>>({});
  const [chosen, setChosen] = useState<Record<string, Choice>>({});
  const [requested, setRequested] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, startLoading] = useTransition();
  const pickerRoot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [picker, setPicker] = useState<TableFilterField>();
  useEffect(() => {
    if (!requested) return;
    let current = true;
    const loaders = fields.filter((field) => field.loadOptions);
    if (!loaders.length) return;
    startLoading(async () => {
      const results = await Promise.all(
        loaders.map(async (field) => {
          try {
            const result = await field.loadOptions!("");
            return { name: field.name, result };
          } catch {
            return { name: field.name, result: null };
          }
        }),
      );
      if (!current) return;
      setRemote(
        Object.fromEntries(
          results.map(({ name, result }) => [
            name,
            result?.ok ? result.data : [],
          ]),
        ),
      );
      setFailed(results.some(({ result }) => !result?.ok));
    });
    return () => {
      current = false;
    };
  }, [fields, requested, retry]);

  // Arc has fixed English microcopy. Translate at the application boundary,
  // preserving its source, motion, roles and keyboard behavior.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const localize = () => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const translations: Record<string, string> = {
        "No filters applied": t("noFilters"),
        "Clear all": compact
          ? t("clearAllFiltersCompact")
          : t("clearAllFilters"),
      };
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const translated = translations[node.nodeValue ?? ""];
        if (translated) node.nodeValue = translated;
      }
      element
        .querySelector("button[data-filter-trigger]")
        ?.setAttribute("aria-label", t("addFilter"));
      element
        .querySelector("button[data-filter-trigger]")
        ?.setAttribute("title", t("addFilter"));
      element.querySelectorAll("button").forEach((button) => {
        if (
          [t("clearAllFilters"), t("clearAllFiltersCompact")].includes(
            button.textContent ?? "",
          )
        ) {
          button.setAttribute("aria-label", t("clearAllFilters"));
          button.setAttribute("title", t("clearAllFilters"));
          if (
            button.textContent !==
            (compact ? t("clearAllFiltersCompact") : t("clearAllFilters"))
          ) {
            const text = button.querySelector("span");
            if (text)
              text.textContent = compact
                ? t("clearAllFiltersCompact")
                : t("clearAllFilters");
          }
        }
      });
      element
        .querySelectorAll('[aria-label="Back to fields"]')
        .forEach((node) => node.setAttribute("aria-label", t("backToFields")));
      element.querySelectorAll("button[data-chip-remove]").forEach((node) => {
        const field = fields.find(
          (field) => field.name === node.getAttribute("data-chip-remove"),
        );
        if (!field) return;
        const value =
          chosen[field.name]?.value === field.value
            ? chosen[field.name].label
            : (field.options.find((option) => option.value === field.value)
                ?.label ??
              remote[field.name]?.find((option) => option.value === field.value)
                ?.label ??
              field.value ??
              "");
        node.setAttribute(
          "aria-label",
          t("removeFilter", { field: field.label, value }),
        );
        node.setAttribute("title", `${field.label}: ${value}`);
        node.parentElement?.setAttribute("title", `${field.label}: ${value}`);
      });
      element
        .querySelectorAll('[role="menuitem"], [role="menuitemradio"]')
        .forEach((node) => {
          const name = node.textContent ?? "";
          if (node.getAttribute("title") !== name)
            node.setAttribute("title", name);
        });
      element
        .querySelector('[role="status"]')
        ?.setAttribute("aria-hidden", "true");
    };
    localize();
    const observer = new MutationObserver(localize);
    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [fields, t, compact, chosen, remote]);

  const choices = useCallback(
    (field: TableFilterField) => {
      const values = new Map(
        (remote[field.name] ?? []).map((option) => [option.value, option]),
      );
      for (const option of field.options) {
        if (!values.has(option.value)) values.set(option.value, option);
      }
      const selected = chosen[field.name];
      if (selected) values.set(selected.value, selected);
      const options = [...values.values()];
      // Arc returns the displayed label on selection. Disambiguate equal names
      // so they still resolve to the correct database identifier.
      const counts = new Map<string, number>();
      for (const option of options)
        counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
      return options.map((option) => ({
        ...option,
        label:
          (counts.get(option.label) ?? 0) > 1
            ? `${option.label} (${option.value})`
            : option.label,
      }));
    },
    [remote, chosen],
  );
  const fullFilters = useMemo(
    () =>
      fields
        .filter((field) => field.value && field.value !== field.defaultValue)
        .map((field) => ({
          id: field.name,
          label: field.label,
          value:
            choices(field).find((option) => option.value === field.value)
              ?.label ?? field.value,
        })),
    [fields, choices],
  );
  // Arc hands focus to the next chip when this array changes. Keep its identity
  // stable until the applied values change, including while the URL is pending.
  const filterSignature = JSON.stringify(
    fullFilters.map((filter) => ({
      ...filter,
      label: tiny ? chipValue(filter.label, 3) : filter.label,
      value: chipValue(filter.value ?? "", tiny ? 2 : 12),
    })),
  );
  const filters = useMemo(
    () => JSON.parse(filterSignature) as FilterChip[],
    [filterSignature],
  );
  const reset = (field: TableFilterField) =>
    Object.fromEntries([
      [field.name, field.defaultValue ?? ""],
      ...(field.clearKeys ?? []).map((key) => [key, ""]),
    ]);
  const apply = (field: TableFilterField, value: string) =>
    onChange({ ...reset(field), [field.name]: value });
  return (
    <>
      <div
        ref={root}
        className="table-filter-toolbar"
        data-compact={compact || undefined}
        aria-busy={loading}
        onClickCapture={() => setRequested(true)}
        onKeyDownCapture={() => setRequested(true)}
      >
        <FilterToolbar
          label={t("activeFilters")}
          filters={filters}
          onRemove={(name) => {
            const field = fields.find((field) => field.name === name);
            if (field) onChange(reset(field));
          }}
          onClearAll={() => onChange(Object.assign({}, ...fields.map(reset)))}
          addFilter={{
            label: compact ? t("addFilterCompact") : t("addFilter"),
            align: "end",
            fields: fields.map((field) => {
              const options = choices(field);
              const selected = options.find(
                (option) => option.value === field.value,
              );
              const quick = selected
                ? [
                    selected,
                    ...options.filter((option) => option.value !== field.value),
                  ].slice(0, 50)
                : options.slice(0, 50);
              return {
                id: field.name,
                label: field.label,
                options: [
                  ...quick.map((option) => ({
                    ...option,
                    label:
                      option.value === field.value
                        ? chipValue(option.label, tiny ? 2 : 12)
                        : option.label,
                    ...(option.value === field.value &&
                    chipValue(option.label, tiny ? 2 : 12) !== option.label
                      ? { hint: option.label }
                      : {}),
                  })),
                  ...(field.loadOptions || options.length > 50
                    ? [{ value: searchValue, label: t("searchFilterValues") }]
                    : []),
                ],
              };
            }),
            onAdd: (chip, arcField) => {
              const field = fields.find((field) => field.name === arcField.id);
              if (!field) return;
              const matches = arcField.options.filter(
                (option) =>
                  typeof option !== "string" && option.label === chip.value,
              );
              if (matches.length !== 1) {
                setPicker(field);
                return;
              }
              const selected = matches[0];
              if (typeof selected === "string") return;
              if (selected.value === searchValue) {
                setPicker(field);
                return;
              }
              const option = choices(field).find(
                (option) => option.value === selected.value,
              );
              if (option) {
                setChosen((previous) => ({
                  ...previous,
                  [field.name]: option,
                }));
                apply(field, option.value);
              }
            },
          }}
        />
      </div>
      <span className="sr-only" role="status">
        {`${t("filterCount", { count: filters.length })}. ${fullFilters.map((filter) => `${filter.label}: ${filter.value}`).join(", ")}`}
      </span>
      {tiny && fullFilters.length > 0 && (
        <dl className="table-filter-details" aria-label={t("activeFilters")}>
          {fullFilters.map((filter) => (
            <div key={filter.id}>
              <dt>{filter.label}</dt>
              <dd>{filter.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {loading && (
        <div className="table-filter-feedback">
          <Skeleton label={t("loadingFilterValues")} lines={1} />
        </div>
      )}
      {failed && (
        <div className="table-filter-feedback">
          <Alert tone="danger" title={t("filterValueError")}>
            <Button
              variant="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t("retryFilterValues")}
            </Button>
          </Alert>
        </div>
      )}
      <ResponsiveDialog
        open={Boolean(picker)}
        onOpenChange={(open) => {
          if (!open) setPicker(undefined);
        }}
        title={picker?.label ?? t("addFilter")}
        description={t("filterValueHint")}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          pickerRoot.current
            ?.querySelector<HTMLInputElement>('[role="combobox"]')
            ?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          root.current
            ?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
            ?.focus();
        }}
      >
        {picker && (
          <div ref={pickerRoot}>
            <SearchSelect
              label={picker.label}
              value={picker.value ?? ""}
              options={choices(picker)}
              loadOptions={picker.loadOptions}
              onValueChange={(value, option) => {
                if (!value) return;
                setChosen((previous) => ({
                  ...previous,
                  [picker.name]: option ?? { value, label: value },
                }));
                apply(picker, value);
                setPicker(undefined);
              }}
            />
          </div>
        )}
      </ResponsiveDialog>
    </>
  );
}
