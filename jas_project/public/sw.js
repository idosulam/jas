// Jas Service Worker — offline-first for static assets
const CACHE_NAME = "jas-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip Vite dev-server requests (HMR, module scripts, @vite/client, etc.)
  if (url.pathname.startsWith("/@vite") || url.pathname.startsWith("/@fs") ||
      url.pathname.includes("__vite") || url.searchParams.has("t") ||
      url.searchParams.has("import")) return;

  // Supabase API calls → network only (don't cache auth/data)
  if (url.hostname.includes("supabase")) return;

  // Network-first strategy: always try network first, fall back to cache
  // This prevents stale cached HTML from being served for module scripts
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful same-origin responses with correct content types
        if (response.ok && url.origin === location.origin) {
          const contentType = response.headers.get("content-type") || "";
          // Never cache HTML responses for non-navigation requests
          // (prevents stale index.html from being served for .js/.jsx modules)
          const isNavigation = request.mode === "navigate";
          const isHTML = contentType.includes("text/html");
          if (!isHTML || isNavigation) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
        }
        return response;
      })
      .catch(() => {
        // Offline fallback: serve from cache
        return caches.match(request);
      })
  );
});
