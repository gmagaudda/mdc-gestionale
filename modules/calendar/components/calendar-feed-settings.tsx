"use client";
import { WriteButton } from "@/components/pwa/write-button";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { rotateCalendarFeed, revokeCalendarFeed } from "../feed-actions";
export function CalendarFeedSettings({
  active,
  loadError = false,
}: {
  active: boolean;
  loadError?: boolean;
}) {
  const t = useTranslations("calendarFeed");
  const [enabled, setEnabled] = useState(active),
    [url, setUrl] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [pending, start] = useTransition();
  const createButton = useRef<HTMLButtonElement>(null);
  async function rotate() {
    setError("");
    setMessage("");
    const result = await rotateCalendarFeed();
    if (result.ok) {
      setEnabled(true);
      setUrl(result.data);
      setMessage(t("created"));
    } else setError(t("error"));
    return result;
  }
  return (
    <section
      className="stack"
      aria-labelledby="calendar-feed-title"
      aria-busy={pending}
    >
      <h2 id="calendar-feed-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      <p className="text-secondary">{t("privacy")}</p>
      <Alert
        open={loadError || !!error}
        tone="danger"
        title={loadError ? t("loadError") : error}
      />
      <Alert open={!!message} tone="success" title={message} />
      {!url && !loadError && <p>{t(enabled ? "active" : "empty")}</p>}
      {url && (
        <Input
          label={t("url")}
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
      <div className="list-sort">
        {!enabled ? (
          <WriteButton
            ref={createButton}
            variant="secondary"
            size="lg"
            loading={pending}
            disabled={pending || loadError}
            onClick={() =>
              start(async () => {
                await rotate();
              })
            }
          >
            {t("create")}
          </WriteButton>
        ) : (
          <>
            <ConfirmAction
              label={t("rotate")}
              confirmLabel={t("rotate")}
              question={t("rotateQuestion")}
              action={async () => {
                const result = await rotate();
                return result.ok ? { ok: true, data: undefined } : result;
              }}
            />
            <ConfirmAction
              label={t("revoke")}
              confirmLabel={t("revoke")}
              question={t("revokeQuestion")}
              action={async () => {
                const result = await revokeCalendarFeed();
                if (result.ok) {
                  setEnabled(false);
                  setUrl("");
                  setError("");
                  setMessage(t("revoked"));
                  requestAnimationFrame(() => createButton.current?.focus());
                }
                return result;
              }}
            />
          </>
        )}
        {url && (
          <Button
            variant="secondary"
            size="lg"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setError("");
                setMessage(t("copied"));
              } catch {
                setError(t("copyError"));
              }
            }}
          >
            {t("copy")}
          </Button>
        )}
      </div>
    </section>
  );
}
