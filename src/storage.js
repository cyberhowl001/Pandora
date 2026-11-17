import { supabase } from "../supabaseClient";
import { mediaSrc } from "./utils";

const BUCKET = "media";

const EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};
const extOf = (type = "") => EXT[type] || type.split("/")[1] || "bin";
const uid8 = () => Math.random().toString(36).slice(2, 10);

// src can be a data: URL or a normal URL
const toBlob = async (src) => (await fetch(src)).blob();

// Upload one media object ({data,type,name}) and return the small object stored in the post:
// { url, path, type, name }. Already-uploaded files (with a url) are returned unchanged.
export async function uploadMedia(f, userId, folder = "posts") {
  if (f?.url) return f;
  const blob = await toBlob(mediaSrc(f));
  const type = f.type || blob.type;
  const path = `${userId}/${folder}/${Date.now()}-${uid8()}.${extOf(type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: type, cacheControl: "31536000", upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path, type, name: f.name || null };
}

// Profile photo: a data: URL goes to storage and the public URL is returned.
// Anything else (an existing URL, null) is returned as it is.
export async function uploadAvatar(src, userId) {
  if (!src || !src.startsWith("data:")) return src;
  const blob = await toBlob(src);
  const path = `${userId}/avatar/${Date.now()}-${uid8()}.${extOf(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type, cacheControl: "31536000", upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// best effort: never blocks the app if it fails
export async function removeMedia(paths) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  try { await supabase.storage.from(BUCKET).remove(list); } catch { /* ignore */ }
}

// used when an account is deleted: removes everything the user uploaded
export async function removeUserMedia(userId) {
  try {
    for (const sub of ["posts", "avatar"]) {
      const folder = `${userId}/${sub}`;
      for (;;) {
        const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 100 });
        if (!data?.length) break;
        const { error } = await supabase.storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
        if (error) break;
      }
    }
  } catch { /* ignore */ }
}