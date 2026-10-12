"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useOnlineStatus } from "@/lib/pwa/online";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type PwaState = {
  waiting: ServiceWorker | null;
  installEvent: InstallEvent | null;
  installed: boolean;
  ios: boolean;
  registrationError: boolean;
  install: () => Promise<boolean>;
  update: () => void;
};
const Context = createContext<PwaState | null>(null);
const subscribePlatform = (listener: () => void) => {
  const display = matchMedia("(display-mode: standalone)");
  display.addEventListener("change", listener);
  return () => display.removeEventListener("change", listener);
};
const platformInstalled = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const noopSubscribe = () => () => {};
export function usePwa() {
  const value = useContext(Context);
  if (!value) throw Error("PwaProvider required");
  return value;
}
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const standalone = useSyncExternalStore(
    subscribePlatform,
    platformInstalled,
    () => false,
  );
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const ios =
    mounted &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const [installedByEvent, setInstalled] = useState(false),
    [registrationError, setRegistrationError] = useState(false);
  const installed = standalone || installedByEvent;
  const reloadRequested = useRef(false);
  useEffect(() => {
    // Capture before React dispatches a submit, including Enter and requestSubmit().
    const blockWrite = (event: Event) => {
      const form = event.target;
      if (
        !navigator.onLine &&
        form instanceof HTMLFormElement &&
        form.querySelector('[data-business-write="true"]')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("submit", blockWrite, true);
    return () => document.removeEventListener("submit", blockWrite, true);
  }, []);
  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    )
      return;
    let disposed = false,
      registration: ServiceWorkerRegistration | undefined;
    const cleanups: (() => void)[] = [];
    const changed = () => {
      if (reloadRequested.current) {
        reloadRequested.current = false;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((result) => {
        if (disposed) return;
        registration = result;
        if (result.waiting) setWaiting(result.waiting);
        const found = () => {
          const worker = result.installing;
          if (!worker) return;
          const state = () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller &&
              !disposed
            )
              setWaiting(result.waiting || worker);
          };
          worker.addEventListener("statechange", state);
          cleanups.push(() => worker.removeEventListener("statechange", state));
        };
        result.addEventListener("updatefound", found);
        cleanups.push(() => result.removeEventListener("updatefound", found));
        found();
      })
      .catch(() => {
        if (!disposed) setRegistrationError(true);
      });
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      document.removeEventListener("visibilitychange", check);
      for (const cleanup of cleanups) cleanup();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        waiting,
        installEvent,
        installed,
        ios,
        registrationError,
        install: async () => {
          if (!installEvent || !online) return false;
          try {
            await installEvent.prompt();
            const choice = await installEvent.userChoice;
            setInstallEvent(null);
            return choice.outcome === "accepted";
          } catch {
            setInstallEvent(null);
            return false;
          }
        },
        update: () => {
          if (waiting && online) {
            reloadRequested.current = true;
            waiting.postMessage({ type: "SKIP_WAITING" });
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
