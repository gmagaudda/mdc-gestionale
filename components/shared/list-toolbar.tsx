"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { ErpIcon } from "./erp-icon";

import {
  TableFilterToolbar,
  type TableFilterField,
} from "./table-filter-toolbar";

export function ListToolbar({
  base,
  query,
  parameters,
  filters,
  children,
  searchName = "q",
}: {
  base: string;
  query: string;
  parameters: Record<string, string>;
  filters?: TableFilterField[];
  children?: ReactNode;
  searchName?: string;
}) {
  const t = useTranslations("lists");
  const router = useRouter();
  const params = useSearchParams().toString();
  const draft = useRef(params);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchId = useId();
  const urlValue = new URLSearchParams(params).get(searchName) ?? "";
  const [pending, start] = useTransition();
  const [search, setSearch] = useState({
    urlValue,
    value: query,
    edited: false,
  });
  // A completed search must not replace text entered during that request.
  // Once the draft is settled, back/forward navigation follows the URL again.
  if (
    search.urlValue !== urlValue ||
    (search.edited && !pending && search.value === urlValue)
  ) {
    setSearch({
      urlValue,
      value: search.edited ? search.value : urlValue,
      edited: search.edited && (pending || search.value !== urlValue),
    });
  }
  useEffect(() => {
    draft.current = params;
  }, [params]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function filter(changes: Record<string, string>, replace = false) {
    const next = new URLSearchParams(draft.current);
    next.delete("page");
    next.delete("from");
    next.delete("to");
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    draft.current = next.toString();
    start(() => {
      if (replace) router.replace(`${base}?${next}`, { scroll: false });
      else router.push(`${base}?${next}`, { scroll: false });
    });
  }
  function searchFor(value: string) {
    clearTimeout(timer.current);
    filter({ [searchName]: value }, true);
  }
  function scheduleSearch(value: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => searchFor(value), 250);
  }

  const [expanded, setExpanded] = useState(Boolean(query));
  const toggle = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  return (
    <div className="list-toolbar" aria-busy={pending}>
      <div className="list-toolbar-fields">
        {expanded ? (
          <motion.form
            action={base}
            className="table-search-expanded"
            role="search"
            aria-label={t("tableSearch")}
            onSubmit={(event) => {
              event.preventDefault();
              searchFor(search.value);
            }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scaleX: 0.96 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setExpanded(false);
                toggle.current?.focus();
              }
            }}
          >
            {Object.entries(parameters)
              .filter(([name]) => name !== searchName && name !== "page")
              .map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
            <label className="sr-only" htmlFor={searchId}>
              {t("tableSearch")}
            </label>
            <input
              id={searchId}
              className="table-search-input"
              type="search"
              name={searchName}
              value={search.value}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setSearch({ urlValue, value, edited: true });
                if (!(event.nativeEvent as InputEvent).isComposing)
                  scheduleSearch(value);
              }}
              onCompositionStart={() => clearTimeout(timer.current)}
              onCompositionEnd={(event) =>
                scheduleSearch(event.currentTarget.value)
              }
              aria-describedby={`${searchId}-hint`}
              placeholder={t("tableSearchHint")}
              maxLength={100}
              autoFocus
            />
            <span id={`${searchId}-hint`} className="sr-only">
              {t("searchEnter")}
            </span>
          </motion.form>
        ) : (
          <div className="table-inline-filters">
            {filters?.length ? (
              <TableFilterToolbar
                fields={filters}
                onChange={(changes) => {
                  clearTimeout(timer.current);
                  filter({ [searchName]: search.value, ...changes });
                }}
              />
            ) : null}
          </div>
        )}
        <Button
          ref={toggle}
          variant="secondary"
          size="lg"
          type="button"
          aria-label={t("search")}
          title={t("search")}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <ErpIcon name="search" />
        </Button>
      </div>
      {children}
    </div>
  );
}
