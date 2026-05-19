// Cache versioning - increment to force cache refresh
const CACHE_VERSION = "v2";
const STATIC_CACHE = `laundrytrack-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `laundrytrack-runtime-${CACHE_VERSION}`;

// Core assets to precache for offline functionality
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/icon.svg",
  "/apple-icon.png",
  "/icon-light-32x32.png",
  "/icon-dark-32x32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // API mutations are handled by app-level offline queue logic.
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    // Network-first strategy for navigation requests
    // Fallback order: cached page -> offline page -> root
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses
          if (response.ok) {
            const copy = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Try cached version of requested page
          const cached = await caches.match(event.request);
          if (cached) {
            return cached;
          }
          // Fallback to dedicated offline page
          const offlinePage = await caches.match("/offline");
          if (offlinePage) {
            return offlinePage;
          }
          // Last resort: root page
          return caches.match("/");
        }),
    );
    return;
  }

  // API GET requests: Cache-first with network update (stale-while-revalidate)
  if (isSameOrigin && requestUrl.pathname.startsWith("/api/") && event.request.method === "GET") {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        
        // Fetch from network and update cache in background
        const networkRequest = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        // Return cached immediately if available, otherwise wait for network
        return cached || networkRequest;
      }),
    );
    return;
  }

  // Static assets: Cache-first strategy
  if (isSameOrigin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }
        // Not in cache, fetch from network and cache
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      }),
    );
  }
});
