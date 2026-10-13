"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { WriteButton } from "./write-button";
import { usePwa } from "./pwa-provider";
import { useOnlineStatus } from "@/lib/pwa/online";
import {
  readPushSubscription,
  revokePushSubscription,
  revokeAllPushSubscriptions,
  sendTestPush,
  savePushSubscription,
} from "@/modules/notifications/actions";
function publicKeyBytes(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export function PushSettings({ publicKey }: { publicKey: string | null }) {
  const t = useTranslations("push"),
    pwa = usePwa(),
    online = useOnlineStatus();
  const [state, setState] = useState<
    "loading" | "unsupported" | "denied" | "off" | "on" | "error"
  >(publicKey ? "loading" : "off");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      if (!publicKey) return;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !window.isSecureContext
      ) {
        if (!disposed) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!disposed) setState("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        const result = subscription
          ? await readPushSubscription(subscription.endpoint)
          : null;
        if (!disposed)
          setState(
            result && !result.ok
              ? "error"
              : result?.ok && result.data
                ? "on"
                : "off",
          );
      } catch {
        if (!disposed) setState("error");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [publicKey]);
  async function enable() {
    if (!publicKey || !online) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      // Permission is requested only in this explicit user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration?.active) throw Error("unavailable");
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKeyBytes(publicKey),
        }));
      const result = await savePushSubscription(subscription.toJSON());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("on");
      setSuccess("enabled");
    } catch {
      setError("saveError");
    } finally {
      setPending(false);
    }
  }
  async function revoke() {
    if (!online) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw Error("unavailable");
      // Revoke server consent first. A browser unsubscribe failure cannot send more reminders.
      const result = await revokePushSubscription(subscription.endpoint);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("off");
      setSuccess("revoked");
      await subscription.unsubscribe().catch(() => false);
    } catch {
      setError("saveError");
    } finally {
      setPending(false);
    }
  }
  async function revokeAll() {
    if (!online) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await revokeAllPushSubscriptions();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState(state === "denied" || state === "unsupported" ? state : "off");
      setSuccess("revokedAll");
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        await subscription?.unsubscribe().catch(() => false);
      }
    } catch {
      setError("saveError");
    } finally {
      setPending(false);
    }
  }
  async function sendTest() {
    if (!online || state !== "on") return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw Error("unavailable");
      const result = await sendTestPush(subscription.toJSON());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("testSent");
    } catch {
      setError("testError");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="stack" aria-label={t("title")}>
      <p>{t("description")}</p>
      {!publicKey ? (
        <p>{t("unconfigured")}</p>
      ) : state === "loading" ? (
        <Skeleton lines={2} label={t("loading")} />
      ) : (
        <>
          <p>
            {t(
              state === "on"
                ? "active"
                : state === "unsupported"
                  ? "unsupported"
                  : state === "denied"
                    ? "denied"
                    : "inactive",
            )}
          </p>
          {pwa.ios && !pwa.installed && <p>{t("iosInstall")}</p>}
          {state !== "unsupported" && state !== "denied" && (
            <WriteButton
              type="button"
              variant="secondary"
              size="lg"
              loading={pending}
              disabled={pending || (pwa.ios && !pwa.installed)}
              onClick={() => void (state === "on" ? revoke() : enable())}
            >
              {t(state === "on" ? "revoke" : "enable")}
            </WriteButton>
          )}
        </>
      )}
      <WriteButton
        type="button"
        variant="secondary"
        size="lg"
        loading={pending}
        disabled={pending}
        onClick={() => void revokeAll()}
      >
        <span className="list-button-copy">{t("revokeAll")}</span>
      </WriteButton>
      {state === "on" && (
        <WriteButton
          type="button"
          variant="secondary"
          size="lg"
          loading={pending}
          disabled={pending}
          onClick={() => void sendTest()}
        >
          {t("sendTest")}
        </WriteButton>
      )}
      {(error || state === "error") && (
        <Alert tone="danger" title={t("errorTitle")}>
          {t(
            error === "invalid" ||
              error === "unconfigured" ||
              error === "testWait" ||
              error === "testError"
              ? error
              : "saveError",
          )}
        </Alert>
      )}
      <div role="status" aria-live="polite">
        {success && t(success)}
      </div>
    </section>
  );
}
