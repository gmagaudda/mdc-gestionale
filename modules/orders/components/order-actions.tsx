"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Alert } from "@/components/arc/alert/alert";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { allowedTransitions } from "../domain";
import type { OrderStatus } from "../schema";
import type { Role } from "@/lib/auth/roles";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { changeOrderStatus, duplicateOrder, archiveOrder } from "../actions";
export function OrderActions({
  id,
  status,
  role,
}: {
  id: string;
  status: OrderStatus;
  role: Role;
}) {
  const t = useTranslations("orders");
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const transitions = allowedTransitions(status, role).filter(
    (next) => next !== "invoiced",
  );
  const change = (next: OrderStatus) => {
    setError("");
    setNotice("");
    start(async () => {
      try {
        const result = await changeOrderStatus({ id, status: next, note });
        if (!result.ok) setError(result.error);
        else {
          setNotice(t("stateSaved"));
          setCancelOpen(false);
          setNote("");
          router.refresh();
        }
      } catch {
        setError("saveError");
      }
    });
  };
  return (
    <section className="stack" aria-label={t("actions")}>
      <h2>{t("actions")}</h2>
      {transitions.length > 0 && (
        <Textarea
          label={t("stateNote")}
          value={note}
          maxLength={1000}
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
      <div className="list-sort">
        {transitions
          .filter((next) => next !== "cancelled")
          .map((next) => (
            <Button
              key={next}
              size="lg"
              disabled={pending}
              loading={pending}
              onClick={() => change(next)}
            >
              {t(`transitions.${next}`)}
            </Button>
          ))}
        {transitions.includes("cancelled") && (
          <ResponsiveDialog
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            title={t("transitions.cancelled")}
            description={t("cancelQuestion")}
            busy={pending}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }}
            trigger={
              <Button size="lg" variant="secondary" disabled={pending}>
                {t("transitions.cancelled")}
              </Button>
            }
          >
            <Alert
              open={Boolean(error)}
              tone="danger"
              title={error ? t(error) : ""}
            />
            <div className="list-sort">
              <Button
                ref={cancelRef}
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() => setCancelOpen(false)}
              >
                {t("closeCancellation")}
              </Button>
              <Button
                variant="danger"
                size="lg"
                disabled={pending}
                loading={pending}
                onClick={() => change("cancelled")}
              >
                {t("transitions.cancelled")}
              </Button>
            </div>
          </ResponsiveDialog>
        )}
        {role !== "accounting" && (
          <Button
            variant="secondary"
            size="lg"
            disabled={pending}
            loading={pending}
            onClick={() => {
              setError("");
              start(async () => {
                try {
                  const result = await duplicateOrder(id);
                  if (!result.ok) setError(result.error);
                  else {
                    router.push(`/orders/${result.data}/edit?duplicated=1`);
                    router.refresh();
                  }
                } catch {
                  setError("saveError");
                }
              });
            }}
          >
            {t("duplicate")}
          </Button>
        )}
      </div>
      {role !== "accounting" && ["draft", "cancelled"].includes(status) && (
        <ConfirmAction
          label={t("archive")}
          confirmLabel={t("archive")}
          question={t("archiveQuestion")}
          action={() => archiveOrder(id)}
          destination="/orders"
        />
      )}
      <p role="status">{notice}</p>
      <Alert
        open={Boolean(error) && !cancelOpen}
        tone="danger"
        title={error ? t(error) : ""}
      />
      {!transitions.length && <p>{t("noTransitions")}</p>}
    </section>
  );
}
