"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { FormField as Input } from "@/components/shared/form-field";
import { Textarea } from "@/components/arc/textarea/textarea";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { saveBrand } from "../actions";
import { brandSchema, emptyBrand, type BrandValues } from "../schema";

export function BrandForm({
  id = null,
  initial = emptyBrand,
}: {
  id?: string | null;
  initial?: BrandValues;
}) {
  const t = useTranslations("brands");
  const router = useRouter();
  const { register, control, handleSubmit, setFocus } = useForm<BrandValues>({
    defaultValues: initial,
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = handleSubmit((values) => {
    setError("");
    setFields({});
    const parsed = brandSchema.safeParse(values);
    if (!parsed.success) {
      setFields(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            t("validation"),
          ]),
        ),
      );
      setFocus(parsed.error.issues[0].path[0] as keyof BrandValues);
      return;
    }
    start(async () => {
      try {
        const result = await saveBrand(id, parsed.data);
        if (!result.ok) setError(result.error);
        else {
          router.push(`/brands/${result.data}?saved=1`);
          router.refresh();
        }
      } catch {
        setError("saveError");
      }
    });
  });
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        {(
          [
            "name",
            "legal_name",
            "vat_number",
            "tax_code",
            "address",
            "city",
            "country",
          ] as const
        ).map((key) => (
          <Input
            key={key}
            label={t(key)}
            {...register(key)}
            error={fields[key]}
            required={key === "name" || key === "country"}
            maxLength={key === "country" ? 2 : 200}
          />
        ))}
        <Input
          label={t("commission_pct")}
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          {...register("commission_pct", { valueAsNumber: true })}
          error={fields.commission_pct}
        />
      </div>
      <Textarea
        label={t("notes")}
        {...register("notes")}
        error={fields.notes}
        rows={4}
        maxLength={10000}
      />
      <Controller
        name="can_see_customer_names"
        control={control}
        render={({ field }) => (
          <RadioGroup
            label={t("visibility")}
            name={field.name}
            value={field.value ? "yes" : "no"}
            onValueChange={(value) => field.onChange(value === "yes")}
            options={[
              { value: "yes", label: t("visibilityYes") },
              { value: "no", label: t("visibilityNo") },
            ]}
          />
        )}
      />
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
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
          variant="secondary"
          size="lg"
          type="button"
          disabled={pending}
          onClick={() => router.push(id ? `/brands/${id}` : "/brands")}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
