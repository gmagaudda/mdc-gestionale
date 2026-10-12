"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { WriteButton as Button } from "@/components/pwa/write-button";
import { Alert } from "@/components/arc/alert/alert";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { centsToDecimal } from "@/lib/money";
import { paymentSchema } from "../schema";
import {
  registerPayment,
  retryInvoice,
  reconcileInvoice,
  cancelInvoice,
} from "../actions";
export function InvoiceControls({
  id,
  status,
  balance,
  today,
  externalId,
  canRetry,
  canCancel,
}: {
  id: string;
  status: string;
  balance: string;
  today: string;
  externalId: boolean;
  canRetry: boolean;
  canCancel: boolean;
}) {
  const t = useTranslations("invoices"),
    router = useRouter(),
    form = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    amount: centsToDecimal(BigInt(balance)),
    paidDate: today,
    method: "bank_transfer",
    note: "",
  });
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [key, setKey] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const payable = ["issued", "sent"].includes(status) && BigInt(balance) > 0n;
  const run = (action: () => ReturnType<typeof retryInvoice>) => {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await action();
        if (!result.ok) setError(t(result.error));
        else {
          setNotice(t("statusUpdated"));
          router.refresh();
        }
      } catch {
        setError(t("saveError"));
      }
    });
  };
  return (
    <section className="stack" aria-label={t("actions")}>
      <div className="list-sort">
        {canRetry && (
          <Button
            size="lg"
            disabled={pending}
            loading={pending}
            onClick={() => run(() => retryInvoice(id))}
          >
            {t("retry")}
          </Button>
        )}
        {externalId && (
          <Button
            size="lg"
            variant="secondary"
            disabled={pending}
            loading={pending}
            onClick={() => run(() => reconcileInvoice(id))}
          >
            {t("refreshStatus")}
          </Button>
        )}
        {canCancel && (
          <ConfirmAction
            label={t("cancelInvoice")}
            confirmLabel={t("cancelInvoice")}
            question={t("cancelQuestion")}
            action={async () => {
              const result = await cancelInvoice(id);
              if (result.ok) {
                setNotice(t("invoiceCancelled"));
                requestAnimationFrame(() => noticeRef.current?.focus());
              }
              return result;
            }}
          />
        )}
      </div>
      {payable && (
        <form
          ref={form}
          className="stack"
          noValidate
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault();
            setFields({});
            setError("");
            setNotice("");
            const nextKey = key || crypto.randomUUID();
            if (!key) setKey(nextKey);
            const input = { invoiceId: id, idempotencyKey: nextKey, ...values };
            const parsed = paymentSchema.safeParse(input);
            if (!parsed.success) {
              setFields(
                Object.fromEntries(
                  parsed.error.issues.map((i) => [
                    String(i.path[0]),
                    t(i.path[0] === "amount" ? "amountError" : "required"),
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
            if (BigInt(parsed.data.amount) > BigInt(balance)) {
              setFields({ amount: t("overpayment") });
              requestAnimationFrame(() =>
                form.current
                  ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                  ?.focus(),
              );
              return;
            }
            start(async () => {
              try {
                const result = await registerPayment(input);
                if (!result.ok) setError(t(result.error));
                else {
                  setNotice(t("paymentSaved"));
                  requestAnimationFrame(() => noticeRef.current?.focus());
                  setKey("");
                  setValues({ ...values, amount: "", note: "" });
                  router.refresh();
                }
              } catch {
                setError(t("saveError"));
              }
            });
          }}
        >
          <h2>{t("registerPayment")}</h2>
          <p>{t("paymentHint")}</p>
          <fieldset className="form-grid" disabled={pending}>
            <legend className="sr-only">{t("registerPayment")}</legend>
            <Input
              label={t("amount")}
              name="amount"
              inputMode="decimal"
              value={values.amount}
              error={fields.amount}
              onChange={(e) => {
                setValues({ ...values, amount: e.target.value });
                setKey("");
              }}
              description={t("amountHint")}
            />
            <Input
              label={t("paidDate")}
              name="paidDate"
              type="date"
              value={values.paidDate}
              error={fields.paidDate}
              onChange={(e) => {
                setValues({ ...values, paidDate: e.target.value });
                setKey("");
              }}
            />
            <Select
              label={t("method")}
              name="method"
              value={values.method}
              onValueChange={(method) => {
                setValues({ ...values, method });
                setKey("");
              }}
              options={["bank_transfer", "cash", "card", "other"].map(
                (method) => ({ value: method, label: t(`methods.${method}`) }),
              )}
            />
            <Textarea
              label={t("note")}
              name="note"
              value={values.note}
              maxLength={1000}
              onChange={(e) => {
                setValues({ ...values, note: e.target.value });
                setKey("");
              }}
            />
          </fieldset>
          <div className="form-actions report-actions">
            <Button
              size="lg"
              type="submit"
              disabled={pending}
              loading={pending}
            >
              {t("registerPayment")}
            </Button>
          </div>
        </form>
      )}
      <p role="status" ref={noticeRef} tabIndex={-1}>
        {notice}
      </p>
      <Alert open={!!error} title={error} tone="danger" />
    </section>
  );
}
