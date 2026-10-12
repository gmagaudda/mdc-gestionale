"use client";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { SelectField } from "./select-field";
import type { ActionResult } from "@/lib/errors";
export type Choice = { value: string; label: string };
export function SearchSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  disabled = false,
  error,
  loadOptions,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Choice[];
  disabled?: boolean;
  error?: string;
  loadOptions?: (term: string) => Promise<ActionResult<Choice[]>>;
}) {
  const t = useTranslations("common");
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState(options);
  const [loadError, setLoadError] = useState(false);
  const [pending, start] = useTransition();
  const request = useRef(0);
  const all = loadOptions ? remote : options;
  const selected =
    options.find((item) => item.value === value) ??
    remote.find((item) => item.value === value);
  const matches = all.filter((item) =>
    item.label.toLocaleLowerCase("it").includes(query.toLocaleLowerCase("it")),
  );
  const shown = matches.slice(0, 50);
  if (selected && !shown.some((item) => item.value === value))
    shown.unshift(selected);
  return (
    <div className="stack search-select">
      <Input
        label={t("searchChoice", { field: label })}
        type="search"
        value={query}
        maxLength={100}
        disabled={disabled}
        onChange={(event) => {
          const term = event.target.value;
          setQuery(term);
          if (loadOptions) {
            const ticket = ++request.current;
            setLoadError(false);
            start(async () => {
              try {
                const result = await loadOptions(term);
                if (ticket === request.current) {
                  if (result.ok) setRemote(result.data);
                  else setLoadError(true);
                }
              } catch {
                if (ticket === request.current) setLoadError(true);
              }
            });
          }
        }}
      />
      <SelectField
        id={id}
        label={label}
        placeholder={t("selectChoice")}
        value={value}
        onValueChange={onValueChange}
        options={shown}
        disabled={disabled || pending}
        error={error}
        description={pending ? t("loadingChoices") : undefined}
      />
      {matches.length > 50 && <p>{t("refineSearch")}</p>}
      {loadError && <p role="alert">{t("choiceError")}</p>}
    </div>
  );
}
