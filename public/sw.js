/* Public assets only. Bump CACHE_VERSION when releasing an application update. */
const CACHE_VERSION = "v1";
const PUBLIC_CACHE = `mdc-public-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";
const ICONS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];
function isPublicAsset(url) {
  return (
    url.origin === self.location.origin &&
    !url.search &&
    (url.pathname.startsWith("/_next/static/") || ICONS.includes(url.pathname))
  );
}
function cacheable(response) {
  return (
    response.ok &&
    response.type !== "opaque" &&
    !response.headers.has("Set-Cookie") &&
    !/(?:private|no-store)/i.test(
      response.headers.get("Cache-Control") || "",
    ) &&
    !/text\/html/i.test(response.headers.get("Content-Type") || "")
  );
}
async function prepareOffline() {
  // /offline is force-static, never reads the session and is fetched without cookies.
  const response = await fetch(OFFLINE_URL, {
    credentials: "omit",
    cache: "reload",
  });
  if (
    !response.ok ||
    /(?:private|no-store)/i.test(response.headers.get("Cache-Control") || "") ||
    response.headers.has("Set-Cookie")
  )
    throw Error("Public offline page unavailable");
  const cache = await caches.open(PUBLIC_CACHE);
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const resources = [
    ...new Set(
      [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  for (const path of [...ICONS, ...resources]) {
    const asset = await fetch(path, { credentials: "omit", cache: "reload" });
    if (cacheable(asset)) await cache.put(path, asset);
  }
}
self.addEventListener("install", (event) => event.waitUntil(prepareOffline()));
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name !== PUBLIC_CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "CLEAR_PRIVATE_CACHE")
    event.waitUntil(
      (async () => {
        for (const name of await caches.keys())
          if (name !== PUBLIC_CACHE) await caches.delete(name);
        const cache = await caches.open(PUBLIC_CACHE);
        for (const request of await cache.keys()) {
          const url = new URL(request.url);
          if (!(
            url.origin === self.location.origin &&
            !url.search &&
            (url.pathname === OFFLINE_URL || isPublicAsset(url))
          ))
            await cache.delete(request);
        }
      })(),
    );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  // No mutation, API, RSC, private HTML, PDF, signed URL or external request is cached.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const fallback = await (
          await caches.open(PUBLIC_CACHE)
        ).match(OFFLINE_URL);
        return fallback || new Response("", { status: 503 });
      }),
    );
    return;
  }
  if (!isPublicAsset(url)) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(PUBLIC_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(
        new Request(request, { credentials: "omit" }),
      );
      if (cacheable(response)) await cache.put(request, response.clone());
      return response;
    })(),
  );
});
// The push body is intentionally generic. Private event fields are never sent.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        if (!event.data || event.data.text().length > 2000) return;
        data = event.data.json();
      } catch {
        return;
      }
      if (
        typeof data?.title !== "string" ||
        data.title.length > 80 ||
        typeof data.body !== "string" ||
        data.body.length > 300 ||
        data.url !== "/calendar" ||
        !/^appointment-[a-f0-9-]{36}$/.test(data.tag)
      )
        return;
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        data: { url: "/calendar" },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      // Never navigate to a URL supplied by a notification or a foreign origin.
      const target = new URL("/calendar", self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          const navigated = await client.navigate(target);
          if (navigated) await navigated.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
