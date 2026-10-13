"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SearchSelect, type Choice } from "@/components/shared/search-select";
import { WriteButton } from "@/components/pwa/write-button";
import { Alert } from "@/components/arc/alert/alert";
import { sendOrderConfirmation } from "../confirmation";
export type ConfirmationHistory = {
  id: string;
  contact: string;
  state: "pending" | "sent" | "logged" | "failed";
  created_at: string;
  completed_at: string | null;
};
export function OrderConfirmation({
  orderId,
  customerId,
  contacts,
  history,
  loadError,
}: {
  orderId: string;
  customerId: string;
  contacts: Choice[];
  history: ConfirmationHistory[];
  loadError: boolean;
}) {
  const t = useTranslations("orderEmail"),
    router = useRouter();
  const [contactId, setContact] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="stack" aria-labelledby="order-email-heading">
      <h2 id="order-email-heading">{t("heading")}</h2>
      <p>{t("description")}</p>
      {loadError ? (
        <Alert tone="danger" title={t("loadError")} />
      ) : contacts.length ? (
        <form
          className="stack"
          aria-busy={pending}
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            setNotice("");
            if (!contactId) {
              setError("recipientError");
              event.currentTarget
                .querySelector<HTMLInputElement>('[role="combobox"]')
                ?.focus();
              return;
            }
            start(async () => {
              try {
                const result = await sendOrderConfirmation({
                  orderId,
                  contactId,
                });
                if (result.ok) {
                  setNotice(t(result.data));
                  router.refresh();
                } else setError(result.error);
              } catch {
                setError("sendError");
              }
            });
          }}
        >
          <SearchSelect
            label={t("recipient")}
            options={contacts}
            value={contactId}
            onValueChange={(value) => {
              setContact(value);
              setError("");
              setNotice("");
            }}
            disabled={pending}
            error={error === "recipientError" ? t(error) : undefined}
          />
          <div>
            <WriteButton
              size="lg"
              variant="secondary"
              type="submit"
              loading={pending}
              disabled={pending}
            >
              {t("send")}
            </WriteButton>
          </div>
        </form>
      ) : (
        <p>{t("noContacts")}</p>
      )}
      <Link className="text-link" href={`/customers/${customerId}`}>
        {t("manageContacts")}
      </Link>
      <p role="status">{pending ? t("sending") : notice}</p>
      <Alert
        open={Boolean(error) && error !== "recipientError"}
        tone="danger"
        title={error ? t(error) : ""}
      />
      {history.length > 0 && (
        <div className="stack">
          <h3>{t("history")}</h3>
          <ol className="stack">
            {history.map((row) => (
              <li key={row.id}>
                <p>
                  {row.contact}: {t(`states.${row.state}`)}
                </p>
                <time dateTime={row.completed_at ?? row.created_at}>
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Europe/Rome",
                  }).format(new Date(row.completed_at ?? row.created_at))}
                </time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
