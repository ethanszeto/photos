const CACHE_NAME = "photo-vault-v2";

/** Static assets only — never precache auth-gated routes (redirects break Safari). */
const PRECACHE_URLS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

function isRedirect(response) {
  return response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400);
}

function cacheableStaticAsset(pathname) {
  return pathname.startsWith("/icons/") || pathname === "/manifest.webmanifest";
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API, Next internals, and all HTML/RSC navigations — network only (no SW redirects).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    request.mode === "navigate" ||
    request.headers.get("Rsc") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    !cacheableStaticAsset(url.pathname)
  ) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && !isRedirect(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
    ),
  );
});
