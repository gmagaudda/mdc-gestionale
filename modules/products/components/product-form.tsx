"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, Controller, useWatch } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { SelectField as Select } from "@/components/shared/select-field";
import { MoneyInput } from "@/components/arc/money-input/money-input";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { saveProduct } from "../actions";
import { productSchema, emptyProduct, type ProductValues } from "../schema";
type Values = Omit<ProductValues, "sizes" | "colors"> & {
  sizes: string;
  colors: string;
};
export function ProductForm({
  id = null,
  initial = emptyProduct,
  brands,
  seasons,
}: {
  id?: string | null;
  initial?: ProductValues;
  brands: { id: string; name: string }[];
  seasons: { id: string; brand_id: string; name: string; code: string }[];
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const { register, control, handleSubmit, setFocus, setValue } =
    useForm<Values>({
      defaultValues: {
        ...initial,
        sizes: initial.sizes.join(", "),
        colors: initial.colors.join(", "),
      },
    });
  const brand = useWatch({ control, name: "brand_id" });
  const sizes = useWatch({ control, name: "sizes" });
  const colors = useWatch({ control, name: "colors" });
  const labels = (value: string) =>
    value
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
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
        const parsed = productSchema.safeParse({
          ...values,
          sizes: labels(values.sizes),
          colors: labels(values.colors),
        });
        if (!parsed.success) {
          setFields(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                t("validation"),
              ]),
            ),
          );
          setFocus(parsed.error.issues[0].path[0] as keyof Values);
          return;
        }
        start(async () => {
          try {
            const result = await saveProduct(id, parsed.data);
            if (!result.ok) setError(result.error);
            else {
              router.push(`/products/${result.data}?saved=1`);
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      })}
    >
      <div className="form-grid">
        <Controller
          name="brand_id"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              label={t("brand")}
              placeholder={t("chooseBrand")}
              onValueChange={(value) => {
                field.onChange(value);
                setValue("season_id", "");
              }}
              options={brands.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              disabled={Boolean(id)}
              error={fields.brand_id}
            />
          )}
        />
        <Controller
          name="season_id"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              label={t("season")}
              placeholder={t("chooseSeason")}
              onValueChange={field.onChange}
              options={seasons
                .filter((item) => item.brand_id === brand)
                .map((item) => ({
                  value: item.id,
                  label: `${item.code}: ${item.name}`,
                }))}
              error={fields.season_id}
            />
          )}
        />
        <Input
          label={t("sku_base")}
          {...register("sku_base")}
          required
          maxLength={80}
          error={fields.sku_base}
        />
        <Input
          label={t("name")}
          {...register("name")}
          required
          maxLength={200}
          error={fields.name}
        />
        {(["wholesale_price_cents", "retail_price_cents"] as const).map(
          (key) => (
            <Controller
              key={key}
              name={key}
              control={control}
              render={({ field }) => (
                <MoneyInput
                  label={t(key)}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(value) => field.onChange(value ?? 0)}
                  currency="EUR"
                  currencies={["EUR"]}
                  locale="it-IT"
                  quickAdd={[]}
                  error={fields[key]}
                />
              )}
            />
          ),
        )}
        <Input
          label={t("vat_rate")}
          {...register("vat_rate", { valueAsNumber: true })}
          type="number"
          min={0}
          max={100}
          step="0.01"
          inputMode="decimal"
          error={fields.vat_rate}
        />
        <Input
          label={t("sizes")}
          {...register("sizes")}
          description={t("commaSeparated")}
          required
          error={fields.sizes}
        />
        <Input
          label={t("colors")}
          {...register("colors")}
          description={t("commaSeparated")}
          required
          error={fields.colors}
        />
      </div>
      <p role="status">
        {t("variantCount", {
          count: labels(sizes).length * labels(colors).length,
        })}
      </p>
      <Textarea
        label={t("description")}
        {...register("description")}
        maxLength={10000}
        error={fields.description}
      />
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
      <div className="form-actions">
        <Button type="submit" size="lg" loading={pending} disabled={pending}>
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => router.push(id ? `/products/${id}` : "/products")}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
