"use client";
import {
  createContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { ErpIcon } from "./erp-icon";

export const TableFilterNavigation = createContext<
  ((name: string, value: string, clearKeys: string[]) => void) | null
>(null);

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
  filters?: ReactNode;
  children?: ReactNode;
  searchName?: string;
}) {
  const t = useTranslations("lists");
  const router = useRouter();
  const params = useSearchParams().toString();
  const draft = useRef(params);
  useEffect(() => {
    draft.current = params;
  }, [params]);
  const [pending, start] = useTransition();
  function filter(name: string, value: string, clearKeys: string[]) {
    const next = new URLSearchParams(draft.current);
    next.delete("page");
    next.delete("from");
    next.delete("to");
    for (const key of clearKeys) next.delete(key);
    if (value) next.set(name, value);
    else next.delete(name);
    draft.current = next.toString();
    start(() => router.push(`${base}?${next}`, { scroll: false }));
  }

  const [expanded, setExpanded] = useState(Boolean(query));
  const toggle = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  return (
    <TableFilterNavigation.Provider value={filter}>
      <div className="list-toolbar" aria-busy={pending}>
        <div className="list-toolbar-fields">
          {expanded ? (
            <motion.form
              action={base}
              className="table-search-expanded"
              role="search"
              aria-label={t("tableSearch")}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scaleX: 0.96 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={
                reduced ? { duration: 0 } : motionTokens.spring.smooth
              }
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
              <Input
                label={t("tableSearch")}
                type="search"
                name={searchName}
                defaultValue={query}
                placeholder={t("tableSearchHint")}
                maxLength={100}
                autoFocus
              />
              <span className="sr-only">{t("searchEnter")}</span>
            </motion.form>
          ) : (
            <div className="table-inline-filters">{filters}</div>
          )}
          <Button
            ref={toggle}
            variant="secondary"
            size="lg"
            type={expanded ? "submit" : "button"}
            aria-label={t("search")}
            title={t("search")}
            aria-expanded={expanded}
            onClick={() => {
              if (!expanded) setExpanded(true);
              else
                toggle.current
                  ?.closest(".list-toolbar-fields")
                  ?.querySelector<HTMLFormElement>("form")
                  ?.requestSubmit();
            }}
          >
            <ErpIcon name="search" />
          </Button>
        </div>
        {children}
      </div>
    </TableFilterNavigation.Provider>
  );
}
