"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { useOnlineStatus } from "@/lib/pwa/online";
import { usePwa } from "./pwa-provider";
export function PwaStatus() {
  const t = useTranslations("pwa"),
    online = useOnlineStatus(),
    pwa = usePwa();
  const [confirm, setConfirm] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Alert open={!online} tone="warning" title={t("offlineTitle")}>
        {t("offlineHint")}
      </Alert>
      <Alert
        open={pwa.registrationError}
        tone="warning"
        title={t("registrationError")}
      />
      <Alert open={Boolean(pwa.waiting)} tone="info" title={t("updateTitle")}>
        <div className="stack">
          <p>{t("updateDescription")}</p>
          <div>
            <ResponsiveDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={t("updateQuestion")}
              description={t("updateWarning")}
              trigger={
                <Button variant="secondary" size="lg" disabled={!online}>
                  {t("update")}
                </Button>
              }
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                cancel.current?.focus();
              }}
            >
              <div className="list-sort">
                <Button
                  ref={cancel}
                  variant="secondary"
                  size="lg"
                  onClick={() => setConfirm(false)}
                >
                  {t("cancel")}
                </Button>
                <Button size="lg" disabled={!online} onClick={pwa.update}>
                  {t("update")}
                </Button>
              </div>
            </ResponsiveDialog>
          </div>
        </div>
      </Alert>
    </>
  );
}
export function PwaInstall() {
  const t = useTranslations("pwa"),
    pwa = usePwa(),
    online = useOnlineStatus();
  const [open, setOpen] = useState(false);
  if (pwa.installed) return <p role="status">{t("installed")}</p>;
  if (pwa.installEvent)
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled={!online}
        onClick={() => {
          void pwa.install();
        }}
      >
        {t("install")}
      </Button>
    );
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title={t("install")}
      trigger={
        <Button variant="secondary" size="lg" disabled={!online}>
          {t("install")}
        </Button>
      }
    >
      <p>{t(pwa.ios ? "installIOS" : "installBrowser")}</p>
      <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
        {t("close")}
      </Button>
    </ResponsiveDialog>
  );
}
