"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { logout } from "@/modules/auth/actions";
import { clearLocalSession } from "@/lib/pwa/session";
export function LogoutForm() {
  const t = useTranslations("common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      action={async () => {
        setPending(true);
        setError(false);
        try {
          if ("serviceWorker" in navigator) {
            await (async () => {
              const registration =
                await navigator.serviceWorker.getRegistration("/");
              const subscription =
                await registration?.pushManager?.getSubscription();
              await subscription?.unsubscribe();
            })().catch(() => undefined);
          }
          await clearLocalSession();
        } finally {
          const result = await logout();
          if (!result.ok) {
            setError(true);
            setPending(false);
          }
        }
      }}
    >
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        loading={pending}
        disabled={pending}
      >
        {t("logout")}
      </Button>
      {error && <Alert tone="danger" title={t("logoutError")} />}
    </form>
  );
}
