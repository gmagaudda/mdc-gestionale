"use client";
export function isPublicCacheEntry(url: URL, origin: string) {
  return (
    url.origin === origin &&
    !url.search &&
    (url.pathname === "/offline" ||
      url.pathname.startsWith("/_next/static/") ||
      [
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/icons/maskable-512.png",
        "/icons/apple-touch-icon.png",
      ].includes(url.pathname))
  );
}
// No business data is persisted locally. Retain only the public offline shell.
export async function clearLocalSession() {
  localStorage.clear();
  sessionStorage.clear();
  if ("caches" in window)
    for (const name of await caches.keys()) {
      if (!name.startsWith("mdc-public-")) {
        await caches.delete(name);
        continue;
      }
      const cache = await caches.open(name);
      for (const request of await cache.keys())
        if (!isPublicCacheEntry(new URL(request.url), location.origin))
          await cache.delete(request);
    }
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_PRIVATE_CACHE",
  });
}
