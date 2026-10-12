"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { SearchSelect, type Choice } from "@/components/shared/search-select";
import { searchOrderCustomers } from "@/modules/orders/actions";
import { parseCents, centsToDecimal } from "@/lib/money";
import { budgetSchema, type BudgetInput } from "../schema";
import {
  saveBudget,
  searchBudgetBrands,
  searchBudgetSeasons,
} from "../actions";
export function BudgetForm({
  brands,
  existing,
}: {
  brands: Choice[];
  existing?: BudgetInput & {
    id: string;
    updated_at: string;
    season_name?: string;
    customer_name?: string;
  };
}) {
  const t = useTranslations("budgets"),
    router = useRouter(),
    form = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState<
    Omit<BudgetInput, "amount_cents"> & { amount_cents: number | null }
  >(
    existing ?? {
      brand_id: "",
      season_id: "",
      customer_id: "",
      amount_cents: null,
      period_start: "",
      period_end: "",
      notes: "",
    },
  );
  const [fields, setFields] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const [amount, setAmount] = useState(
    existing ? centsToDecimal(existing.amount_cents) : "",
  );
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof value>(key: K, data: (typeof value)[K]) =>
    setValue((current) => ({ ...current, [key]: data }));
  const none = { value: "none", label: t("none") };
  return (
    <form
      className="stack"
      ref={form}
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        setFields({});
        const parsed = budgetSchema.safeParse(value);
        if (!parsed.success) {
          setFields(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                t(issue.message === "dateRange" ? "dateRange" : "required"),
              ]),
            ),
          );
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          );
          return;
        }
        start(async () => {
          try {
            const result = await saveBudget(
              existing?.id ?? null,
              parsed.data,
              existing?.updated_at ?? null,
            );
            if (!result.ok) setError(t(result.error));
            else {
              router.push(`/budgets/${result.data}?saved=1`);
              router.refresh();
            }
          } catch {
            setError(t("saveError"));
          }
        });
      }}
    >
      <p>{t("scopeHint")}</p>
      <Alert open={!!error} tone="danger" title={error} />
      <fieldset className="form-grid" disabled={pending}>
        <legend className="sr-only">{t(existing ? "edit" : "create")}</legend>
        <SearchSelect
          label={t("brand")}
          value={value.brand_id}
          options={brands}
          error={fields.brand_id}
          disabled={!!existing}
          loadOptions={searchBudgetBrands}
          onValueChange={(brand) =>
            setValue((current) => ({
              ...current,
              brand_id: brand,
              season_id: "",
            }))
          }
        />
        <Input
          label={t("amount")}
          value={amount}
          inputMode="decimal"
          maxLength={30}
          description={t("amountHint")}
          onChange={(event) => {
            setAmount(event.target.value);
            set("amount_cents", parseCents(event.target.value));
          }}
          error={fields.amount_cents}
          disabled={pending}
        />
        {value.brand_id && (
          <SearchSelect
            key={value.brand_id}
            label={t("season")}
            value={value.season_id || "none"}
            options={[
              none,
              ...(existing?.season_id && existing.season_name
                ? [{ value: existing.season_id, label: existing.season_name }]
                : []),
            ]}
            error={fields.season_id}
            loadOptions={async (term) => {
              const result = await searchBudgetSeasons(value.brand_id, term);
              return result.ok
                ? { ok: true, data: [none, ...result.data] }
                : result;
            }}
            onValueChange={(season) =>
              set("season_id", season === "none" ? "" : season)
            }
          />
        )}
        <SearchSelect
          label={t("customer")}
          value={value.customer_id || "none"}
          options={[
            none,
            ...(existing?.customer_id && existing.customer_name
              ? [{ value: existing.customer_id, label: existing.customer_name }]
              : []),
          ]}
          error={fields.customer_id}
          loadOptions={async (term) => {
            const result = await searchOrderCustomers(term);
            return result.ok
              ? { ok: true, data: [none, ...result.data] }
              : result;
          }}
          onValueChange={(customer) =>
            set("customer_id", customer === "none" ? "" : customer)
          }
        />
        <Input
          label={t("start")}
          type="date"
          value={value.period_start}
          onChange={(e) => set("period_start", e.target.value)}
          error={fields.period_start}
          required
        />
        <Input
          label={t("end")}
          type="date"
          value={value.period_end}
          onChange={(e) => set("period_end", e.target.value)}
          error={fields.period_end}
          required
        />
        <Textarea
          label={t("notes")}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={5000}
          error={fields.notes}
        />
      </fieldset>
      <div className="form-actions">
        <Button type="submit" size="lg" loading={pending} disabled={pending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            router.push(existing ? `/budgets/${existing.id}` : "/budgets")
          }
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
