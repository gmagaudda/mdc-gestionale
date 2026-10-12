"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { saveUser } from "../actions";
import { inviteSchema, userSchema, type UserValues } from "../schema";
type Values = UserValues & { email: string };
export function UserForm({
  id,
  initial,
  brands,
}: {
  id?: string;
  initial?: Values;
  brands: { id: string; name: string }[];
}) {
  const t = useTranslations("users");
  const router = useRouter();
  const { register, control, handleSubmit, setFocus, setValue } =
    useForm<Values>({
      defaultValues: initial ?? {
        email: "",
        full_name: "",
        role: "staff",
        is_active: true,
        brand_ids: [],
      },
    });
  const role = useWatch({ control, name: "role" });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFields({});
        setError("");
        const parsed = (id ? userSchema : inviteSchema).safeParse(values);
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
            const result = id
              ? await saveUser(id, values)
              : await (
                  await fetch("/api/users/invite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(values),
                  })
                ).json();
            if (!result.ok) setError(result.error);
            else {
              router.push(`/settings/users/${id ?? result.data}?saved=1`);
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      })}
    >
      <div className="form-grid">
        <Input
          label={t("full_name")}
          {...register("full_name")}
          required
          error={fields.full_name}
        />
        <Input
          label={t("email")}
          type="email"
          {...register("email")}
          readOnly={Boolean(id)}
          required
          error={fields.email}
        />
      </div>
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <RadioGroup
            label={t("role")}
            name={field.name}
            value={field.value}
            onValueChange={(value) => {
              field.onChange(value);
              if (value !== "brand") setValue("brand_ids", []);
            }}
            options={(["admin", "staff", "accounting", "brand"] as const).map(
              (value) => ({ value, label: t(value) }),
            )}
          />
        )}
      />
      {role === "brand" && (
        <fieldset className="stack brand-selection">
          <legend>{t("brands")}</legend>
          <Controller
            name="brand_ids"
            control={control}
            render={({ field }) => (
              <>
                {brands.map((brand) => (
                  <Checkbox
                    key={brand.id}
                    label={brand.name}
                    checked={field.value.includes(brand.id)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked
                          ? [...field.value, brand.id]
                          : field.value.filter((value) => value !== brand.id),
                      )
                    }
                  />
                ))}
              </>
            )}
          />
          {!brands.length && <p>{t("noBrands")}</p>}
          {fields.brand_ids && <p role="alert">{t("brandRequired")}</p>}
        </fieldset>
      )}
      {id && (
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <RadioGroup
              label={t("status")}
              name={field.name}
              value={field.value ? "active" : "inactive"}
              onValueChange={(value) => field.onChange(value === "active")}
              options={[
                { value: "active", label: t("active") },
                { value: "inactive", label: t("inactive") },
              ]}
            />
          )}
        />
      )}
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
      <div className="form-actions">
        <WriteButton
          size="lg"
          type="submit"
          loading={pending}
          disabled={pending}
        >
          {t(id ? "save" : "invite")}
        </WriteButton>
        <Button
          size="lg"
          variant="secondary"
          type="button"
          disabled={pending}
          onClick={() => router.push("/settings/users")}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
