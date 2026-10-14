"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { useOnlineStatus } from "@/lib/pwa/online";
import { usePwa } from "./pwa-provider";
import {
  readPushSubscription,
  revokePushSubscription,
  savePushSubscription,
} from "@/modules/notifications/actions";

export function usePushToggle(publicKey: string | null, open: boolean) {
  const [attempt, reload] = useReducer((value: number) => value + 1, 0);
  const online = useOnlineStatus();
  const pwa = usePwa();
  const [state, setState] = useState<
    "loading" | "on" | "off" | "denied" | "unsupported" | "error"
  >("loading");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState<"enabled" | "revoked" | null>(null);
  const subscription = useRef<PushSubscription | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!open || !publicKey) return;
    let disposed = false;
    void (async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window) ||
        !window.isSecureContext
      ) {
        if (!disposed) setState("unsupported");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const current = await registration?.pushManager.getSubscription();
        const result = current
          ? await readPushSubscription(current.endpoint)
          : null;
        if (disposed || busy.current) return;
        subscription.current = current ?? null;
        setState(
          result && !result.ok
            ? "error"
            : result?.ok && result.data
              ? "on"
              : Notification.permission === "denied"
                ? "denied"
                : "off",
        );
      } catch {
        if (!disposed && !busy.current) setState("error");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [open, publicKey, attempt]);
  const active = state === "on";
  const unavailable = !publicKey
    ? "unconfigured"
    : !online
      ? "offline"
      : pending || state === "loading"
        ? "loading"
        : state === "unsupported"
          ? "unsupported"
          : state === "denied"
            ? "denied"
            : state === "error"
              ? "saveError"
              : !active && pwa.ios && !pwa.installed
                ? "iosInstall"
                : null;
  async function toggle() {
    if (unavailable || !publicKey || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    setSuccess(null);
    try {
      if (active) {
        const current = subscription.current;
        if (!current) throw Error("unavailable");
        const result = await revokePushSubscription(current.endpoint);
        if (!result.ok) throw Error("revoke failed");
        setState(Notification.permission === "denied" ? "denied" : "off");
        setSuccess("revoked");
        // Revoke server consent first, even if the browser cannot unsubscribe.
        await current.unsubscribe().catch(() => false);
        subscription.current = null;
      } else {
        // Called synchronously from the explicit menu action, never on mount.
        const permission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (!registration?.active) throw Error("unavailable");
        const current =
          (await registration.pushManager.getSubscription()) ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: Uint8Array.from(
              atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
              (c) => c.charCodeAt(0),
            ),
          }));
        subscription.current = current;
        const result = await savePushSubscription(current.toJSON());
        if (!result.ok) throw Error("save failed");
        setState("on");
        setSuccess("enabled");
      }
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return {
    active,
    pending,
    unavailable,
    error: error || state === "error",
    success,
    toggle,
    retry: () => {
      setError(false);
      setState("loading");
      reload();
    },
  };
}
