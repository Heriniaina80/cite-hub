const CACHE_NAME = "cite-hub-shell-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/cite-hub.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("cite-hub-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const OFFLINE_SCRIPT_URLS = new Set([
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
]);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Cache only the two read-only JavaScript libraries needed to open the app offline.
  // Never cache Supabase API/auth responses or any private user data in the service worker cache.
  if (request.method === "GET" && OFFLINE_SCRIPT_URLS.has(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) {
          try { await cache.put(request, response.clone()); } catch (cacheError) {}
        }
        return response;
      } catch (error) {
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        throw error;
      }
    })());
    return;
  }

  // Cache this site's static shell only; never cache Supabase/auth/API responses.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/rest/v1/") || url.pathname.includes("/auth/") || url.pathname.includes("/functions/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
        }
        return response;
      }).catch(async () => {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});