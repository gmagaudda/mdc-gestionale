"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { saveCustomerContact } from "../actions";
import { customerContactSchema, type CustomerContactValues } from "../schema";
export function CustomerContactForm({
  customerId,
  id = null,
  initial,
}: {
  customerId: string;
  id?: string | null;
  initial?: CustomerContactValues;
}) {
  const t = useTranslations("customers");
  const router = useRouter();
  const { register, handleSubmit, setFocus, reset } =
    useForm<CustomerContactValues>({
      defaultValues: initial ?? {
        customer_id: customerId,
        name: "",
        role_title: "",
        email: "",
        phone: "",
      },
    });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form
      className="stack"
      noValidate
      onSubmit={handleSubmit((values) => {
        const parsed = customerContactSchema.safeParse({
          ...values,
          customer_id: customerId,
        });
        setFields({});
        setError("");
        setSaved(false);
        if (!parsed.success) {
          setFields(
            Object.fromEntries(
              parsed.error.issues.map((issue) => [
                String(issue.path[0]),
                t("validation"),
              ]),
            ),
          );
          setFocus(
            parsed.error.issues[0].path[0] as keyof CustomerContactValues,
          );
          return;
        }
        start(async () => {
          try {
            const result = await saveCustomerContact(id, parsed.data);
            if (!result.ok) setError(result.error);
            else {
              setSaved(true);
              if (!id) reset();
              router.refresh();
            }
          } catch {
            setError("saveError");
          }
        });
      })}
    >
      <div className="form-grid">
        {(["name", "role_title", "email", "phone"] as const).map((key) => (
          <Input
            key={key}
            label={t(`contact_${key}`)}
            type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
            {...register(key)}
            required={key === "name"}
            error={fields[key]}
          />
        ))}
      </div>
      <Alert
        open={Boolean(error || saved)}
        tone={error ? "danger" : "success"}
        title={error ? t(error) : t("contactSaved")}
      />
      <WriteButton
        variant="secondary"
        type="submit"
        size="lg"
        loading={pending}
        disabled={pending}
      >
        {t(id ? "saveCustomerContact" : "addContact")}
      </WriteButton>
    </form>
  );
}
