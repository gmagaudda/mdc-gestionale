"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Combobox } from "@/components/arc/combobox/combobox";
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
  onValueChange: (value: string, choice?: Choice) => void;
  options: Choice[];
  disabled?: boolean;
  error?: string;
  loadOptions?: (term: string) => Promise<ActionResult<Choice[]>>;
}) {
  const t = useTranslations("common");
  const [remote, setRemote] = useState(options);
  const [chosen, setChosen] = useState<Choice>();
  const [loadError, setLoadError] = useState(false);
  const [pending, start] = useTransition();
  const request = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const all = loadOptions ? remote : options;
  const selected =
    options.find((item) => item.value === value) ??
    all.find((item) => item.value === value) ??
    (chosen?.value === value ? chosen : undefined);
  const shown =
    selected && !all.some((item) => item.value === value)
      ? [selected, ...all]
      : all;
  // Localize Arc's fixed accessible names without changing its source.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const localize = () => {
      element
        .querySelector('button[aria-label="Clear selection"]')
        ?.setAttribute("aria-label", t("clearChoice", { field: label }));
      element.querySelectorAll('[role="option"]').forEach((option) => {
        const name = option.textContent ?? "";
        if (option.getAttribute("title") !== name)
          option.setAttribute("title", name);
      });
      const list = element.querySelector('[role="listbox"]');
      const listLabel = t("choiceOptions", { field: label });
      if (list?.getAttribute("aria-label") !== listLabel)
        list?.setAttribute("aria-label", listLabel);
    };
    localize();
    const observer = new MutationObserver(localize);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [label, t]);
  function search(term: string) {
    if (!loadOptions) return;
    const ticket = ++request.current;
    setLoadError(false);
    start(async () => {
      try {
        const result = await loadOptions(term);
        if (ticket !== request.current) return;
        if (result.ok) setRemote(result.data);
        else {
          setRemote([]);
          setLoadError(true);
        }
      } catch {
        if (ticket === request.current) {
          setRemote([]);
          setLoadError(true);
        }
      }
    });
  }
  return (
    <div ref={root} className="search-select" aria-busy={pending}>
      <Combobox
        id={id}
        label={label}
        value={value}
        options={shown}
        onValueChange={(next) => {
          ++request.current;
          setChosen(shown.find((item) => item.value === next));
          onValueChange(
            next,
            shown.find((item) => item.value === next),
          );
        }}
        placeholder={t("searchOrSelect")}
        emptyMessage={pending ? t("loadingChoices") : t("noChoices")}
        title={selected?.label}
        maxLength={100}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        description={
          error ||
          (loadError
            ? t("choiceError")
            : pending
              ? t("loadingChoices")
              : undefined)
        }
        onInput={(event) => search(event.currentTarget.value)}
        onFocus={() => search("")}
        onBlur={(event) => {
          if (event.currentTarget.getAttribute("aria-expanded") !== "true")
            return;
          event.currentTarget.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
        }}
      />
      {disabled && selected && <p className="wrap-value">{selected.label}</p>}
      {(error || loadError) && (
        <span className="sr-only" role="alert">
          {error || t("choiceError")}
        </span>
      )}
    </div>
  );
}
