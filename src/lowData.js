import { useEffect, useState } from "react";

// Data saver: a switch in Settings. It is OFF by default and only ever changes when the user flips it.
// ON  = photos and videos load only after a tap, and videos do not play by themselves.
// OFF = photos appear automatically and videos play by themselves while they are on screen.
const KEY = "pandora_data_saver"; // "1" = on
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
let on = read();

export const setDataSaver = (value) => {
  on = !!value;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  emit();
};

// keep other open tabs in step
window.addEventListener("storage", (e) => { if (e.key === KEY) { on = read(); emit(); } });

export function useLowData() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return { on, setOn: setDataSaver };
}
