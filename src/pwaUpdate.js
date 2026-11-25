// Registers the service worker and tells the UI when a NEW version is waiting.
// A new version is downloaded in the background but only takes over when the user taps "Update".
import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 30 * 60 * 1000; // look for a new version every 30 minutes while the app is open

let waiting = null;                    // the new service worker that is ready and waiting
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const setWaiting = (worker) => { waiting = worker; emit(); };

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    let reg;
    try {
      reg = await navigator.serviceWorker.register("/service-worker.js", { updateViaCache: "none" });
    } catch (e) {
      console.error("[pwa] service worker failed:", e);
      return;
    }

    // a new version was already downloaded earlier and is waiting
    if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

    // a new version is downloading right now
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // "installed" while an older version controls the page = an update, not the first install
        if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
      });
    });

    // check for a new version now and then, and whenever the user comes back to the app
    const check = () => reg.update().catch(() => {});
    setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  });

  // after the user taps Update, the new version takes control: reload once so the page uses it
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

export function applyUpdate() {
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
}

export function useUpdateAvailable() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return !!waiting;
}
