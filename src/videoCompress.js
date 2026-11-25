// Shrinks a video in the browser until it fits the size limit (quality and resolution are reduced).
// It re-records the video at a lower bitrate, so it takes about as long as the video lasts.
// The screen must stay open while it runs.
const MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const pickMime = () => MIMES.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";

const MAX_COMPRESS_SECONDS = 180; // longer videos are refused: compressing them would take too long
const AUDIO_BPS = 64000;

const once = (el, ev) =>
  new Promise((res, rej) => {
    el.addEventListener(ev, res, { once: true });
    el.addEventListener("error", () => rej(new Error("Could not read this video.")), { once: true });
  });

async function encode(url, mime, vbps, shortSide, onProgress) {
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  await once(video, "loadedmetadata");

  const scale = Math.min(1, shortSide / Math.min(video.videoWidth, video.videoHeight));
  const W = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2);
  const H = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");

  // sound goes to the recording only (nothing plays out loud)
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const dest = ac.createMediaStreamDestination();
  ac.createMediaElementSource(video).connect(dest);

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: vbps, audioBitsPerSecond: AUDIO_BPS });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const finished = new Promise((res) => { rec.onstop = res; });

  let stopped = false;
  let failed = false;
  const stop = () => { if (stopped) return; stopped = true; try { rec.stop(); } catch { /* ignore */ } };
  const draw = () => {
    if (stopped) return;
    g.drawImage(video, 0, 0, W, H);
    onProgress?.(Math.min(1, video.currentTime / video.duration));
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
  };
  video.onended = stop;
  video.onerror = () => { failed = true; stop(); };

  await ac.resume();
  rec.start(1000);
  try { await video.play(); } catch { video.muted = true; await video.play(); } // if sound is blocked, keep the picture
  draw();
  await finished;
  ac.close().catch(() => {});
  if (failed) throw new Error("Could not read this video.");
  return new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] });
}

export async function compressVideo(file, { maxBytes = 10 * 1024 * 1024, onProgress } = {}) {
  const limitMB = Math.round(maxBytes / 1048576);
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("This browser cannot compress videos. Please choose a smaller video.");
  }
  const mime = pickMime();
  const url = URL.createObjectURL(file);
  try {
    const probe = document.createElement("video");
    probe.src = url;
    probe.preload = "metadata";
    await once(probe, "loadedmetadata");
    const duration = probe.duration;
    if (!isFinite(duration) || duration <= 0) throw new Error("Could not read this video.");
    if (duration > MAX_COMPRESS_SECONDS) throw new Error(`Large videos can be up to ${MAX_COMPRESS_SECONDS / 60} minutes. Please trim it or choose a shorter one.`);

    // aim at 70% of the limit (e.g. about 7MB for a 10MB limit), because the recorder only roughly follows the target bitrate
    let vbps = Math.floor((maxBytes * 0.7 * 8) / duration - AUDIO_BPS);
    if (vbps < 250000) throw new Error(`This video is too long to fit in ${limitMB}MB. Please choose a shorter one.`);
    vbps = Math.min(vbps, 4_000_000);
    let shortSide = vbps > 1_500_000 ? 720 : vbps > 700_000 ? 540 : 400;

    let blob = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      blob = await encode(url, mime, vbps, shortSide, (p) => onProgress?.((attempt + p) / 2));
      if (blob.size <= maxBytes) break;
      vbps = Math.floor(vbps * 0.6);        // still too big: lower the quality more and try once more
      shortSide = Math.round(shortSide * 0.8);
    }
    if (!blob || blob.size > maxBytes) throw new Error("Could not shrink this video enough. Please choose a shorter one.");

    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}
