// Pandora service worker.
// __BUILD_ID__ is replaced at build time (see vite.config.js), so EVERY deploy produces a different
// file. The browser notices that, installs the new worker in the background and leaves it WAITING.
// It only takes over when the user taps "Update app" (the page sends SKIP_WAITING).
const VERSION = "__BUILD_ID__";
const CACHE = `pandora-${VERSION}`;

// Download the whole app shell for THIS version, so an older version keeps working
// (and keeps its own files) until the user chooses to update.
// Files from /public that the app uses by name (best effort: a missing one never breaks the install)
const SHELL_EXTRA = ["/manifest.json", "/favicon.ico", "/panda.png", "/logo192.png", "/logo512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch("/index.html", { cache: "reload" });
    const html = await res.clone().text();
    await cache.put("/index.html", res);

    // every file index.html points to; the build's own JS / CSS must succeed, the rest is best effort
    const urls = [...new Set([...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map((m) => m[1]))];
    const code = urls.filter((u) => /\.(js|css)$/.test(u));
    const other = urls.filter((u) => !/\.(js|css)$/.test(u));
    await cache.addAll(code);

    // lazy-loaded chunks named inside the main JS (only exist if the app uses React.lazy / import())
    const chunks = new Set();
    for (const u of code.filter((x) => x.endsWith(".js"))) {
      const hit = await cache.match(u);
      const text = hit ? await hit.text() : "";
      for (const m of text.matchAll(/["'`(]\.?\/?(assets\/[\w.\-]+\.(?:js|css))/g)) chunks.add("/" + m[1]);
    }
    await Promise.all([...new Set([...other, ...SHELL_EXTRA, ...chunks])].map((u) => cache.add(u).catch(() => {})));
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