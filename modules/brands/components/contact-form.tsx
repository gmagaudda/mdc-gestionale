"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { saveContact } from "../actions";
import { contactSchema, type ContactValues } from "../schema";
export function ContactForm({
  brandId,
  id = null,
  initial,
}: {
  brandId: string;
  id?: string | null;
  initial?: ContactValues;
}) {
  const t = useTranslations("brands");
  const router = useRouter();
  const { register, handleSubmit, setFocus, reset } = useForm<ContactValues>({
    defaultValues: initial ?? {
      brand_id: brandId,
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
        const parsed = contactSchema.safeParse({
          ...values,
          brand_id: brandId,
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
          setFocus(parsed.error.issues[0].path[0] as keyof ContactValues);
          return;
        }
        start(async () => {
          try {
            const result = await saveContact(id, parsed.data);
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
        {t(id ? "saveContact" : "addContact")}
      </WriteButton>
    </form>
  );
}
