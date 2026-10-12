"use client";
import { useSyncExternalStore } from "react";
export function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}
export const onlineSnapshot = () => navigator.onLine;
export const serverOnlineSnapshot = () => true;
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    onlineSnapshot,
    serverOnlineSnapshot,
  );
}
