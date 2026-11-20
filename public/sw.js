/* CINEM Pro service worker — deliberately minimal.
 *
 * Caches ONLY static assets (build output, brand files, PWA icons) and an
 * offline fallback page. It never caches /api/* responses or authenticated
 * HTML: navigations are network-first and fall back to /offline only when
 * the network is unreachable. Bump VERSION to retire old caches.
 *
 * v2 (2026-11-20): retire the v1 caches accumulated since the worker first
 * shipped, and match /_next/static/ chunk URLs exactly (no ignoreSearch) —
 * build chunks are content-hashed, so an exact URL is the only safe key.
 */
const VERSION = "cinem-pro-sw-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = ["/offline", "/icon.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/bots/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/icon-maskable-512.png" ||
    url.pathname === "/apple-touch-icon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline", { ignoreSearch: true }).then(
          (cached) =>
            cached ??
            new Response("You are offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            }),
        ),
      ),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      // Exact-URL match: chunk and asset URLs are content-hashed, so a
      // cached entry is only ever valid for the precise URL that produced
      // it. (ignoreSearch stays only on the /offline fallback lookup.)
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
