"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { ResponsiveDialog } from "./responsive-dialog";
import { Alert } from "@/components/arc/alert/alert";
import type { ActionResult } from "@/lib/errors";
export function ConfirmAction({
  label,
  question,
  action,
  destination,
}: {
  label: string;
  question: string;
  action: () => Promise<ActionResult>;
  destination?: string;
}) {
  const t = useTranslations("lists");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <ResponsiveDialog
      open={confirm}
      onOpenChange={(value) => {
        setConfirm(value);
        if (!value) setError(false);
      }}
      title={label}
      description={question}
      busy={pending}
      trigger={
        <Button variant="secondary" size="lg">
          {label}
        </Button>
      }
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        cancelRef.current?.focus();
      }}
    >
      <Alert open={error} tone="danger" title={t("saveError")} />
      <div className="list-sort">
        <Button
          ref={cancelRef}
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => {
            setConfirm(false);
            setError(false);
          }}
        >
          {t("cancel")}
        </Button>
        <Button
          variant="danger"
          size="lg"
          loading={pending}
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const result = await action();
                if (!result.ok) setError(true);
                else {
                  setConfirm(false);
                  if (destination) router.push(destination);
                  router.refresh();
                }
              } catch {
                setError(true);
              }
            })
          }
        >
          {t("confirm")}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
