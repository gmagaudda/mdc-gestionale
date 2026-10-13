"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, type Path } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { saveCustomer } from "../actions";
import { customerSchema, emptyCustomer, type CustomerValues } from "../schema";
export function CustomerForm({
  id = null,
  initial = emptyCustomer,
}: {
  id?: string | null;
  initial?: CustomerValues;
}) {
  const t = useTranslations("customers");
  const router = useRouter();
  const { register, handleSubmit, setFocus } = useForm<CustomerValues>({
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
        setFields({});
        setError("");
        const parsed = customerSchema.safeParse(values);
        if (!parsed.success) {
          setFields(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [
                issue.path.join("."),
                t("validation"),
              ]),
            ),
          );
          setFocus(
            parsed.error.issues[0].path.join(".") as Path<CustomerValues>,
          );
          return;
        }
        start(async () => {
          try {
            const result = await saveCustomer(id, parsed.data);
            if (!result.ok) setError(result.error);
            else {
              router.push(`/customers/${result.data}?saved=1`);
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      })}
    >
      <div className="form-grid">
        {(
          [
            "legal_name",
            "trade_name",
            "vat_number",
            "tax_code",
            "sdi_code",
            "pec",
            "payment_terms",
          ] as const
        ).map((key) => (
          <Input
            key={key}
            label={t(key)}
            type={key === "pec" ? "email" : "text"}
            inputMode={key === "vat_number" ? "numeric" : undefined}
            {...register(key)}
            required={key === "legal_name"}
            error={fields[key]}
            maxLength={
              key === "vat_number"
                ? 11
                : key === "sdi_code"
                  ? 7
                  : key === "payment_terms"
                    ? 500
                    : 200
            }
          />
        ))}
      </div>
      {(["billing_address", "shipping_address"] as const).map((section) => (
        <fieldset className="stack address-fields" key={section}>
          <legend>{t(section)}</legend>
          <div className="form-grid">
            {(
              ["street", "postal_code", "city", "province", "country"] as const
            ).map((key) => {
              const name = `${section}.${key}` as const;
              return (
                <Input
                  key={key}
                  label={t(key)}
                  {...register(name)}
                  required={key === "country"}
                  error={fields[name]}
                  maxLength={key === "country" ? 2 : 200}
                />
              );
            })}
          </div>
        </fieldset>
      ))}
      <Textarea
        label={t("notes")}
        {...register("notes")}
        rows={4}
        maxLength={10000}
        error={fields.notes}
      />
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
          {t("save")}
        </WriteButton>
        <Button
          size="lg"
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => router.push(id ? `/customers/${id}` : "/customers")}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
