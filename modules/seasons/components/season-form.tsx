"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { SelectField as Select } from "@/components/shared/select-field";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { saveSeason } from "../actions";
import { seasonSchema, emptySeason, type SeasonValues } from "../schema";
export function SeasonForm({
  id = null,
  initial = emptySeason,
  brands,
}: {
  id?: string | null;
  initial?: SeasonValues;
  brands: { id: string; name: string }[];
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const { register, control, handleSubmit, setFocus } = useForm<SeasonValues>({
    defaultValues: initial,
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit((values) => {
        setError("");
        setFields({});
        const parsed = seasonSchema.safeParse(values);
        if (!parsed.success) {
          setFields(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                t("validation"),
              ]),
            ),
          );
          setFocus(parsed.error.issues[0].path[0] as keyof SeasonValues);
          return;
        }
        start(async () => {
          try {
            const result = await saveSeason(id, parsed.data);
            if (!result.ok) setError(result.error);
            else {
              router.push(`/seasons/${result.data}?saved=1`);
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      })}
    >
      <Controller
        name="brand_id"
        control={control}
        render={({ field }) => (
          <Select
            {...field}
            label={t("brand")}
            placeholder={t("chooseBrand")}
            onValueChange={field.onChange}
            options={brands.map((brand) => ({
              value: brand.id,
              label: brand.name,
            }))}
            disabled={Boolean(id)}
            error={fields.brand_id}
          />
        )}
      />
      <div className="form-grid">
        <Input
          label={t("code")}
          {...register("code")}
          required
          maxLength={30}
          error={fields.code}
        />
        <Input
          label={t("name")}
          {...register("name")}
          required
          maxLength={200}
          error={fields.name}
        />
        {(
          [
            "campaign_start",
            "campaign_end",
            "delivery_start",
            "delivery_end",
          ] as const
        ).map((key) => (
          <Input
            key={key}
            label={t(key)}
            {...register(key)}
            type="date"
            error={fields[key]}
          />
        ))}
      </div>
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
          type="button"
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => router.push(id ? `/seasons/${id}` : "/seasons")}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
