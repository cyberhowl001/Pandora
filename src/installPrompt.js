// Import this file in main.jsx (before the app renders) so the browser's install event is never missed.
import { useEffect, useState } from "react";

const INSTALLED_KEY = "pandora_installed";

let deferredPrompt = null;        // the browser's install prompt, once it fires
let installedThisSession = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();             // keep it, so OUR button can show it at any time
  deferredPrompt = e;
  console.info("[pwa] install prompt is ready");
  emit();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installedThisSession = true;
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch { /* ignore */ }
  emit();
});

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.navigator.standalone === true; // iOS

// which instructions to show when the browser has no one-tap install
export function getPlatform() {
  const ua = navigator.userAgent || "";
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /crios|fxios|edgios|opios/i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return /samsungbrowser/i.test(ua) ? "android-samsung" : /firefox/i.test(ua) ? "android-firefox" : "android-chrome";
  if (/firefox/i.test(ua)) return "desktop-firefox";
  if (/edg\//i.test(ua)) return "desktop-edge";
  if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) return "desktop-safari";
  return "desktop-chrome";
}

// shows the browser's own install dialog. Returns "accepted" | "dismissed" | "unavailable"
export async function promptInstall() {
  if (!deferredPrompt) return "unavailable";
  const p = deferredPrompt;
  deferredPrompt = null;            // a prompt can only be used once
  emit();
  p.prompt();
  const { outcome } = await p.userChoice;
  return outcome;
}

export function useInstall() {
  const [, force] = useState(0);
  const [standalone, setStandalone] = useState(isStandalone());

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => setStandalone(isStandalone());
    mq.addEventListener?.("change", onMode);
    return () => { listeners.delete(fn); mq.removeEventListener?.("change", onMode); };
  }, []);

  return {
    standalone,                     // already running as an installed app
    installedThisSession,
    nativeReady: !!deferredPrompt,  // one-tap install is available right now
    platform: getPlatform(),
    install: promptInstall,
  };
}
