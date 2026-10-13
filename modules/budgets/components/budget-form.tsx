"use client";
import { WriteButton } from "@/components/pwa/write-button";
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
import {
  BudgetRecommendationPanel,
  type AcceptedRecommendation,
} from "./budget-recommendation";
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
  const [recommendation, setRecommendation] =
    useState<AcceptedRecommendation | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [recommendationStale, setRecommendationStale] = useState(false);
  const set = <K extends keyof typeof value>(
    key: K,
    data: (typeof value)[K],
  ) => {
    const changesScope = ["brand_id", "season_id", "customer_id"].includes(key);
    if (changesScope) {
      if (recommendation) setAmount("");
      setRecommendation(null);
      setRecommendationStale(false);
    }
    setValue((current) => ({
      ...current,
      [key]: data,
      ...(changesScope && recommendation ? { amount_cents: null } : {}),
    }));
  };
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
        if (recommendation && recommendationStale) {
          setError(t("recommendationStale"));
          return;
        }
        const parsed = budgetSchema.safeParse(value);
        if (
          recommendation &&
          value.amount_cents !== recommendation.snapshot.suggested_cents &&
          !adjustmentReason.trim()
        ) {
          setFields({ adjustment_reason: t("adjustmentRequired") });
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLElement>('[aria-invalid="true"]')
              ?.focus(),
          );
          return;
        }
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
              recommendation
                ? {
                    settings: recommendation.settings,
                    expected: recommendation.snapshot.fingerprint,
                    adjustment_reason: adjustmentReason,
                  }
                : undefined,
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
      <Alert open={!!error} tone="danger" title={t("errorTitle")}>
        <span className="wrap-value">{error}</span>
      </Alert>
      <fieldset className="form-grid" disabled={pending}>
        <legend className="sr-only">{t(existing ? "edit" : "create")}</legend>
        <SearchSelect
          label={t("brand")}
          value={value.brand_id}
          options={brands}
          error={fields.brand_id}
          disabled={!!existing}
          loadOptions={searchBudgetBrands}
          onValueChange={(brand) => {
            if (recommendation) setAmount("");
            setRecommendation(null);
            setRecommendationStale(false);
            setValue((current) => ({
              ...current,
              brand_id: brand,
              season_id: "",
              ...(recommendation ? { amount_cents: null } : {}),
            }));
          }}
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
          style={{ minWidth: 0 }}
          value={value.period_start}
          onChange={(e) => set("period_start", e.target.value)}
          error={fields.period_start}
          required
        />
        <Input
          label={t("end")}
          type="date"
          style={{ minWidth: 0 }}
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
      {!existing && value.brand_id && value.season_id && value.customer_id && (
        <BudgetRecommendationPanel
          key={`${value.brand_id}:${value.season_id}:${value.customer_id}`}
          brandId={value.brand_id}
          seasonId={value.season_id}
          customerId={value.customer_id}
          disabled={pending}
          onInvalidate={() => {
            if (recommendation) setRecommendationStale(true);
          }}
          onAccept={(accepted) => {
            setRecommendation(accepted);
            setRecommendationStale(false);
            setError("");
            setAdjustmentReason("");
            setFields({});
            setAmount(centsToDecimal(accepted.snapshot.suggested_cents!));
            set("amount_cents", accepted.snapshot.suggested_cents!);
          }}
        />
      )}
      {recommendation && recommendationStale && (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={pending}
          onClick={() => {
            setRecommendation(null);
            setRecommendationStale(false);
            setError("");
          }}
        >
          <span className="list-button-copy">{t("useManual")}</span>
        </Button>
      )}
      {recommendation &&
        value.amount_cents !== recommendation.snapshot.suggested_cents && (
          <Input
            label={t("adjustmentReason")}
            value={adjustmentReason}
            maxLength={500}
            required
            disabled={pending}
            error={fields.adjustment_reason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
        )}
      <div className="form-actions">
        <WriteButton
          type="submit"
          size="lg"
          loading={pending}
          disabled={pending}
        >
          {t("save")}
        </WriteButton>
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
