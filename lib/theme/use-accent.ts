"use client";
import { useSyncExternalStore } from "react";
import { accents, accentStorageKey, type Accent } from "./accents";
const eventName = "mdc-accent-change";
const read = (): Accent => {
  const value = document.documentElement.dataset.accent;
  return accents.find((accent) => accent === value) ?? "green";
};
const subscribe = (notify: () => void) => {
  const storage = (event: StorageEvent) => {
    if (event.key !== accentStorageKey && event.key !== null) return;
    document.documentElement.dataset.accent =
      accents.find((accent) => accent === event.newValue) ?? "green";
    notify();
  };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener("storage", storage);
  };
};
export function useAccent() {
  const accent = useSyncExternalStore(subscribe, read, () => "green" as Accent);
  const setAccent = (value: Accent) => {
    if (!accents.includes(value)) return;
    document.documentElement.dataset.accent = value;
    try {
      localStorage.setItem(accentStorageKey, value);
    } catch {
      /* Still apply for this page when storage is unavailable. */
    }
    window.dispatchEvent(new Event(eventName));
  };
  return { accent, setAccent };
}
