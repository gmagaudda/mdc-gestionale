"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
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
  return (
    <div className="stack">
      {confirm ? (
        <>
          <p>{question}</p>
          <div className="list-sort">
            <Button
              variant="secondary"
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
            <Button
              variant="ghost"
              size="lg"
              disabled={pending}
              onClick={() => {
                setConfirm(false);
                setError(false);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" size="lg" onClick={() => setConfirm(true)}>
          {label}
        </Button>
      )}
      <Alert open={error} tone="danger" title={t("saveError")} />
    </div>
  );
}
