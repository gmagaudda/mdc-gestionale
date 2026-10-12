import { describe, it, expect, vi, afterEach } from "vitest";
import {
  onlineSnapshot,
  serverOnlineSnapshot,
  subscribeOnline,
} from "./online";
import { isPublicCacheEntry } from "./session";
afterEach(() => vi.unstubAllGlobals());
describe("PWA connection and privacy", () => {
  it("renders online on the server and follows browser connectivity", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(serverOnlineSnapshot()).toBe(true);
    expect(onlineSnapshot()).toBe(false);
    vi.stubGlobal("navigator", { onLine: true });
    expect(onlineSnapshot()).toBe(true);
  });
  it("observes both transitions and removes listeners", () => {
    const window = new EventTarget();
    vi.stubGlobal("window", window);
    const listener = vi.fn(),
      unsubscribe = subscribeOnline(listener);
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    window.dispatchEvent(new Event("offline"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it("retains only anonymous assets and the static fallback during logout", () => {
    const origin = "https://app.example.test";
    for (const path of [
      "/offline",
      "/_next/static/chunks/app.js",
      "/icons/icon-192.png",
    ])
      expect(isPublicCacheEntry(new URL(path, origin), origin)).toBe(true);
    for (const path of [
      "/orders",
      "/api/calendar",
      "/offline?token=private",
      "/icons/private.png",
      "/_next/static/app.js?token=private",
      "https://supabase.test/storage/v1/object/sign/a",
    ])
      expect(isPublicCacheEntry(new URL(path, origin), origin)).toBe(false);
  });
});
