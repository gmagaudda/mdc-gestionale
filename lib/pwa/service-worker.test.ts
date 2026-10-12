import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";
const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const origin = "https://app.example.test";
function harness() {
  const handlers = new Map<string, (event: unknown) => void>(),
    stores = new Map<string, Map<string, Response>>();
  const key = (input: string | Request) =>
    new URL(typeof input === "string" ? input : input.url, origin).href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const map = stores.get(name)!;
      return {
        put: async (input: string | Request, response: Response) => {
          map.set(key(input), response.clone());
        },
        match: async (input: string | Request) => map.get(key(input))?.clone(),
        keys: async () => [...map.keys()].map((url) => new Request(url)),
        delete: async (input: Request) => map.delete(key(input)),
      };
    },
  };
  const fetch = vi.fn(async (input: string | Request, init?: RequestInit) => {
    void init;
    return new Response(
      key(input).endsWith("/offline")
        ? '<html><link href="/_next/static/css/app.css"/></html>'
        : "public",
      {
        headers: {
          "Content-Type": key(input).endsWith("/offline")
            ? "text/html"
            : "text/css",
        },
      },
    );
  });
  const self = {
    location: { origin },
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(
        async () => [] as { url: string; navigate: ReturnType<typeof vi.fn> }[],
      ),
      openWindow: vi.fn(async () => {}),
    },
    registration: { showNotification: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
  };
  runInNewContext(source, { self, caches, fetch, URL, Request, Response });
  const lifecycle = async (type: string, data?: unknown) => {
    let promise: Promise<unknown> | undefined;
    handlers.get(type)!({
      data,
      waitUntil: (p: Promise<unknown>) => {
        promise = p;
      },
    });
    await promise;
  };
  const notification = async (type: string, payload: unknown) => {
    let promise: Promise<unknown> | undefined;
    const close = vi.fn();
    handlers.get(type)!({
      data: { text: () => JSON.stringify(payload), json: () => payload },
      notification: { data: payload, close },
      waitUntil: (p: Promise<unknown>) => {
        promise = p;
      },
    });
    await promise;
    return close;
  };
  const request = async (
    path: string,
    options: { method?: string; mode?: RequestMode } = {},
  ) => {
    let promise: Promise<Response> | undefined;
    const request = new Request(new URL(path, origin), {
      method: options.method,
    });
    // Navigation requests are browser-created; Fetch forbids constructing them.
    if (options.mode)
      Object.defineProperty(request, "mode", { value: options.mode });
    handlers.get("fetch")!({
      request,
      respondWith: (p: Promise<Response>) => {
        promise = p;
      },
    });
    return promise ? await promise : undefined;
  };
  return { self, fetch, caches, stores, lifecycle, request, notification };
}
describe("service worker public-only caching", () => {
  it("precaches a cookie-free offline shell, icons and its immutable stylesheet", async () => {
    const h = harness();
    await h.lifecycle("install");
    expect(h.stores.get("mdc-public-v1")!.size).toBe(6);
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    for (const call of h.fetch.mock.calls)
      expect(call[1]).toMatchObject({ credentials: "omit", cache: "reload" });
  });
  it("refuses an offline shell that could contain session data", async () => {
    const h = harness();
    h.fetch.mockImplementation(
      async () =>
        new Response("private", {
          headers: { "Cache-Control": "private, no-store" },
        }),
    );
    await expect(h.lifecycle("install")).rejects.toThrow();
    expect(h.stores.size).toBe(0);
  });
  it("never intercepts APIs, Supabase, PDF, signed assets or mutations", async () => {
    const h = harness();
    for (const path of [
      "/api/calendar",
      "/orders?_rsc=abc",
      "/api/pdf/order/1",
      "https://supabase.test/rest/v1/orders",
      "/icons/icon-192.png?token=secret",
      "/_next/static/app.js?signature=secret",
    ])
      expect(await h.request(path)).toBeUndefined();
    expect(await h.request("/api/orders", { method: "POST" })).toBeUndefined();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.stores.size).toBe(0);
  });
  it("always fetches authenticated navigation without storing HTML", async () => {
    const h = harness();
    h.fetch.mockImplementation(async () => new Response("Private order"));
    await h.request("/orders", { mode: "navigate" });
    await h.request("/orders", { mode: "navigate" });
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.stores.size).toBe(0);
  });
  it("falls back to public offline HTML when navigation fails", async () => {
    const h = harness();
    await h.lifecycle("install");
    h.fetch.mockRejectedValue(new TypeError("Offline"));
    const response = await h.request("/customers", { mode: "navigate" });
    expect(response?.status).toBe(200);
    expect(await response?.text()).toContain("<html>");
    expect(
      [...h.stores.get("mdc-public-v1")!.keys()].some((url) =>
        url.includes("customers"),
      ),
    ).toBe(false);
  });
  it("uses cache-first static assets and fetches them without credentials", async () => {
    const h = harness();
    await h.request("/_next/static/new.css");
    await h.request("/_next/static/new.css");
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect((h.fetch.mock.calls[0][0] as Request).credentials).toBe("omit");
  });
  it.each<Record<string, string>>([
    { "Cache-Control": "private" },
    { "Cache-Control": "no-store" },
    { "Set-Cookie": "session=secret" },
    { "Content-Type": "text/html" },
  ])("does not cache unsafe asset responses %j", async (headers) => {
    const h = harness();
    h.fetch.mockImplementation(async () => new Response("Unsafe", { headers }));
    await h.request("/_next/static/new.js");
    await h.request("/_next/static/new.js");
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.stores.get("mdc-public-v1")!.size).toBe(0);
  });
  it("purges earlier versions on activation and applies updates only by command", async () => {
    const h = harness();
    await h.caches.open("mdc-public-v0");
    await h.caches.open("mdc-private-old");
    await h.caches.open("mdc-public-v1");
    await h.lifecycle("activate");
    expect(await h.caches.keys()).toEqual(["mdc-public-v1"]);
    expect(h.self.clients.claim).toHaveBeenCalledOnce();
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    await h.lifecycle("message", { type: "SKIP_WAITING" });
    expect(h.self.skipWaiting).toHaveBeenCalledOnce();
  });
  it("clears defensive private caches on logout even while offline", async () => {
    const h = harness();
    await h.lifecycle("install");
    const cache = await h.caches.open("mdc-public-v1");
    await cache.put("/orders", new Response("Private"));
    await h.caches.open("mdc-dynamic-old");
    h.fetch.mockRejectedValue(new TypeError("Offline"));
    await h.lifecycle("message", { type: "CLEAR_PRIVATE_CACHE" });
    expect(await h.caches.keys()).toEqual(["mdc-public-v1"]);
    expect(await cache.match("/orders")).toBeUndefined();
    expect(await cache.match("/offline")).toBeDefined();
  });
});

describe("push service worker", () => {
  it("shows a bounded generic notification with a stable deduplication tag", async () => {
    const h = harness();
    await h.notification("push", {
      title: "MDC Gestionale",
      body: "Hai un appuntamento domani.",
      url: "/calendar",
      tag: "appointment-00000000-0000-4000-8000-000000000001",
    });
    expect(h.self.registration.showNotification).toHaveBeenCalledWith(
      "MDC Gestionale",
      expect.objectContaining({
        body: "Hai un appuntamento domani.",
        data: { url: "/calendar" },
        tag: "appointment-00000000-0000-4000-8000-000000000001",
      }),
    );
  });
  it("rejects unknown destinations and oversized messages", async () => {
    const h = harness();
    for (const payload of [
      { title: "MDC", body: "a", url: "https://evil.test", tag: "wrong" },
      { title: "MDC", body: "a".repeat(2001), url: "/calendar", tag: "wrong" },
    ])
      await h.notification("push", payload);
    expect(h.self.registration.showNotification).not.toHaveBeenCalled();
  });
  it("opens only its own calendar even when notification data contains a foreign URL", async () => {
    const h = harness();
    const closed = await h.notification("notificationclick", {
      url: "https://evil.test",
    });
    expect(closed).toHaveBeenCalledOnce();
    expect(h.self.clients.openWindow).toHaveBeenCalledWith(
      "https://app.example.test/calendar",
    );
  });
  it("reuses and focuses an existing same-origin window", async () => {
    const h = harness(),
      focus = vi.fn(async () => {}),
      navigate = vi.fn(async () => ({ focus }));
    h.self.clients.matchAll.mockResolvedValue([
      { url: "https://app.example.test/dashboard", navigate },
    ]);
    await h.notification("notificationclick", { url: "/calendar" });
    expect(navigate).toHaveBeenCalledWith("https://app.example.test/calendar");
    expect(focus).toHaveBeenCalledOnce();
    expect(h.self.clients.openWindow).not.toHaveBeenCalled();
  });
});
