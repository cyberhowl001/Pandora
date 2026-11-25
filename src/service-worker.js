// Pandora service worker.
// __BUILD_ID__ is replaced at build time (see vite.config.js), so EVERY deploy produces a different
// file. The browser notices that, installs the new worker in the background and leaves it WAITING.
// It only takes over when the user taps "Update app" (the page sends SKIP_WAITING).
const VERSION = "__BUILD_ID__";
const CACHE = `pandora-${VERSION}`;

// Download the whole app shell for THIS version, so an older version keeps working
// (and keeps its own files) until the user chooses to update.
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch("/index.html", { cache: "reload" });
    const html = await res.clone().text();
    await cache.put("/index.html", res);

    const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)].map((m) => m[1]))];
    const must = urls.filter((u) => u.startsWith("/assets/"));   // hashed JS / CSS: must succeed
    const extra = urls.filter((u) => !u.startsWith("/assets/")); // icons, manifest: best effort
    await cache.addAll(must);
    await Promise.all(extra.map((u) => cache.add(u).catch(() => {})));
  })());
  // NO skipWaiting() here: the update waits for the user
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // only same-origin GET: Supabase, Paystack and other API calls are left alone
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/service-worker.js") return;

  // page loads: always this version's index.html (offline works too)
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((hit) => hit || fetch(request))
    );
    return;
  }

  // files: this version's copy first, then the network (and remember it)
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      });
    })
  );
});
