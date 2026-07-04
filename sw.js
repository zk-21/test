const CACHE_NAME = "mobile-agent-cache-v36";
const OFFLINE_ASSETS = [
  "./",
  "./index.html",
  "./compare.html",
  "./compare90.html",
  "./styles.css?v=20260611-layout-9",
  "./script.js?v=20260610-mobile-agent-15",
  "./compare.js?v=20260611-compare-page-17",
  "./manifest.webmanifest",
  "./vendor/xlsx.full.min.js",
  "./vendor/html2canvas.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            if (event.request.url.includes("compare90.html")) return caches.match("./compare90.html");
            return caches.match(event.request.url.includes("compare.html") ? "./compare.html" : "./index.html");
          }
          return Response.error();
        });
    })
  );
});
