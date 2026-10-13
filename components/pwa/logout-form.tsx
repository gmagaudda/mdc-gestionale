"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { logout } from "@/modules/auth/actions";
import { clearLocalSession } from "@/lib/pwa/session";
export async function logoutSession() {
  try {
    if ("serviceWorker" in navigator) {
      await (async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        await subscription?.unsubscribe();
      })().catch(() => undefined);
    }
    await clearLocalSession();
  } catch {
    // A local cache failure must not prevent revoking the server session.
  }
  return await logout();
}
export function LogoutForm() {
  const t = useTranslations("common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <form
      action={async () => {
        setPending(true);
        setError(false);
        const result = await logoutSession();
        if (!result.ok) {
          setError(true);
          setPending(false);
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
