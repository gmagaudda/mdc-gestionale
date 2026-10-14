"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/arc/popover/popover";
import { SearchSelect, type Choice } from "./search-select";
import { ErpIcon } from "./erp-icon";
import type { ActionResult } from "@/lib/errors";

// The compact trigger grows with its value. Arc owns the picker and keyboard behavior.
export function TableFilter({
  label,
  name,
  value = "",
  options = [],
  loadOptions,
  clearKeys = [],
  base,
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  options?: Choice[];
  loadOptions?: (term: string) => Promise<ActionResult<Choice[]>>;
  clearKeys?: string[];
  base: string;
  required?: boolean;
}) {
  const t = useTranslations("lists");
  const router = useRouter();
  const params = useSearchParams();
  const content = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Choice>();
  const selected =
    options.find((option) => option.value === value) ??
    (chosen?.value === value ? chosen : undefined);
  const preview = value ? (selected?.label ?? value) : label;
  const all = { value: "", label: t("allValues") };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="lg"
          className="table-filter-trigger"
          title={`${label}: ${preview}`}
          aria-label={value ? `${label}: ${preview}` : label}
        >
          <span className="wrap-value table-filter-copy">{preview}</span>
          <ErpIcon name="chevron" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={content}
        aria-label={label}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.querySelector<HTMLInputElement>("input")?.focus();
        }}
      >
        <SearchSelect
          label={label}
          value={value}
          options={
            required
              ? options
              : [all, ...options.filter((option) => option.value !== "")]
          }
          loadOptions={
            loadOptions
              ? async (term) => {
                  const result = await loadOptions(term);
                  return result.ok
                    ? {
                        ok: true,
                        data: required ? result.data : [all, ...result.data],
                      }
                    : result;
                }
              : undefined
          }
          onValueChange={(next) => {
            if (required && !next) return;
            if (next === value || (!next && !value)) {
              setOpen(false);
              return;
            }
            setChosen(options.find((option) => option.value === next));
            setOpen(false);
            const nextParams = new URLSearchParams(params.toString());
            nextParams.delete("page");
            nextParams.delete("from");
            nextParams.delete("to");
            for (const key of clearKeys) nextParams.delete(key);
            if (next) nextParams.set(name, next);
            else nextParams.delete(name);
            setOpen(false);
            router.push(`${base}?${nextParams}`, { scroll: false });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
