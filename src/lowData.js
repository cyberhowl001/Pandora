import { useEffect, useState } from "react";

// Data saver: "auto" (follows the phone's data-saver / slow network), "on", or "off".
const KEY = "pandora_low_data";
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const readMode = () => { try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; } };
let mode = readMode();

const connection = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const slowNetwork = () => {
  const c = connection();
  return !!c && (c.saveData === true || ["slow-2g", "2g"].includes(c.effectiveType));
};

export const isLowData = () => mode === "on" || (mode === "auto" && slowNetwork());

export const setLowDataMode = (m) => {
  mode = m;
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  emit();
};

connection()?.addEventListener?.("change", emit); // the network changed: re-check

export function useLowData() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return { low: isLowData(), mode, setMode: setLowDataMode, autoDetected: mode === "auto" && slowNetwork() };
}
