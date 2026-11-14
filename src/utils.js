import { useState, useEffect } from "react";

export const POST_LIFETIME_HOURS = 48;

export const displayName = (u) => {
  if (!u) return "Unknown";
  const n = `${u.surname || ""} ${u.other_name || ""}`.trim();
  return n || u.username || "Unknown";
};

export const fmt = (n = 0) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
};

export const timeLeft = (expiresAt, now = Date.now()) => {
  const ms = Math.max(0, new Date(expiresAt).getTime() - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
};

export const timeAgo = (iso, now = Date.now()) => {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export const same = (a, b) => String(a) === String(b);
export const mediaSrc = (m) => `data:${m.type};base64,${m.data}`;
export const isVideo = (m) => m?.type?.startsWith("video/");

export const readAsDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });

// {data (base64, no prefix), type, name}
export const fileToMedia = async (file) => {
  const url = await readAsDataUrl(file);
  return { data: url.split(",")[1], type: file.type, name: file.name };
};

// Shrinks photos before saving (keeps database rows small)
export async function compressImage(file, maxDim = 1600, quality = 0.8) {
  if (file.type === "image/gif") return fileToMedia(file);
  const url = await readAsDataUrl(file);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { data: out.split(",")[1], type: "image/jpeg", name: file.name };
}

// true on desktop-width screens (Tailwind md and up)
export function useIsDesktop() {
  const q = "(min-width: 768px)";
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = (e) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}
