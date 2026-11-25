// Turns a stored photo / video object into something an <img> or <video> can load.
// Kept in its own file so it works no matter which version of utils.js your project has.
//   new posts: a public URL in Supabase Storage  -> { url, path, type, name }
//   old posts: base64 saved inside the post      -> { data, type, name }
export const mediaUrl = (m) => {
  if (!m) return "";
  if (m.url) return m.url;
  if (m.data) return `data:${m.type};base64,${m.data}`;
  return "";
};

// ---------------------------------------------------------------------------------------------
// WATERMARK for new photos: "Pandora" is drawn INTO the picture before it is uploaded, so it stays
// on the file when someone saves or shares it. Returned media is flagged `wm: true`, so the app does
// not draw the on-screen label on top of it a second time.
// (Animated GIFs are skipped: drawing them on a canvas would remove the animation. They get the
//  on-screen label instead.)
// ---------------------------------------------------------------------------------------------
export const WATERMARK_TEXT = "Pandora";

export async function addWatermark(m) {
  try {
    if (!m || !m.data || m.type === "image/gif") return m;
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = `data:${m.type};base64,${m.data}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const size = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * 0.05)); // 5% of the short side
    const pad = Math.round(size * 0.7);
    ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = size * 0.25;
    ctx.shadowOffsetY = size * 0.05;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(WATERMARK_TEXT, canvas.width - pad, canvas.height - pad);

    const out = canvas.toDataURL("image/jpeg", 0.85);
    return { ...m, data: out.split(",")[1], type: "image/jpeg", wm: true };
  } catch (e) {
    console.warn("[watermark] skipped:", e); // never block a post because of the watermark
    return m;
  }
}
