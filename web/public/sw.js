/*
 * Grezzo service worker.
 *
 * Deliberately conservative. Prices, stock and offers are all live, so
 * nothing dynamic is ever served from cache — the only things cached are
 * immutable build assets and a single offline fallback page.
 *
 * The failure mode of an over-eager shop service worker is showing someone
 * a price that no longer exists, which is worse than a slower page.
 */

const VERSION = "grezzo-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that can change price, stock or session state.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

  // Build output is content-hashed, so it is safe to serve from cache first.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ?? fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return res;
        })),
    );
    return;
  }

  // Pages: always go to the network, fall back to the offline card.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
