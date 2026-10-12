"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { generateInvoiceSchema } from "../schema";
import { generateInvoice } from "../actions";
export function GenerateInvoice({
  orderId,
  today,
  mock,
}: {
  orderId: string;
  today: string;
  mock: boolean;
}) {
  const t = useTranslations("invoices"),
    router = useRouter(),
    form = useRef<HTMLFormElement>(null);
  const [dates, setDates] = useState({ issueDate: today, dueDate: today });
  const [fields, setFields] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="stack">
      <h2>{t("generate")}</h2>
      <p>{t("snapshotHint")}</p>
      {mock && <p>{t("mockHint")}</p>}
      <form
        className="stack"
        ref={form}
        noValidate
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setFields({});
          const input = { orderId, ...dates };
          const result = generateInvoiceSchema.safeParse(input);
          if (!result.success) {
            setFields(
              Object.fromEntries(
                result.error.issues.map((i) => [
                  String(i.path[0]),
                  t("dateError"),
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
              const result = await generateInvoice(input);
              if (!result.ok) setError(t(result.error));
              else {
                router.push(`/invoices/${result.data}`);
                router.refresh();
              }
            } catch {
              setError(t("saveError"));
            }
          });
        }}
      >
        <fieldset className="form-grid" disabled={pending}>
          <legend className="sr-only">{t("generate")}</legend>
          <Input
            label={t("issueDate")}
            type="date"
            name="issueDate"
            value={dates.issueDate}
            error={fields.issueDate}
            onChange={(e) => setDates({ ...dates, issueDate: e.target.value })}
          />
          <Input
            label={t("dueDate")}
            type="date"
            name="dueDate"
            value={dates.dueDate}
            error={fields.dueDate}
            onChange={(e) => setDates({ ...dates, dueDate: e.target.value })}
          />
        </fieldset>
        <Alert open={!!error} tone="danger" title={error} />
        <div className="form-actions report-actions">
          <WriteButton
            size="lg"
            type="submit"
            disabled={pending}
            loading={pending}
          >
            {t("generate")}
          </WriteButton>
        </div>
      </form>
    </section>
  );
}
