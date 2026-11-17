// One-off: moves existing base64 photos/videos/avatars into Supabase Storage.
//
//   npm i @supabase/supabase-js
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=<service_role key> node migrate-media.mjs
//
// Run it from your own computer. NEVER put the service_role key in the app.
// Only posts that are still live are migrated (expired ones are going to be deleted anyway).
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = "media";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const uid8 = () => Math.random().toString(36).slice(2, 10);

// `data` may be a full data: URL or raw base64
function decode(data, fallbackType) {
  let type = fallbackType || "application/octet-stream";
  let b64 = data;
  if (data.startsWith("data:")) {
    const [head, body] = data.split(",");
    type = head.slice(5).split(";")[0] || type;
    b64 = body;
  }
  return { buffer: Buffer.from(b64, "base64"), type };
}

async function upload(data, fallbackType, userId, folder) {
  const { buffer, type } = decode(data, fallbackType);
  const path = `${userId}/${folder}/${Date.now()}-${uid8()}.${EXT[type] || type.split("/")[1] || "bin"}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: type, cacheControl: "31536000" });
  if (error) throw error;
  return { url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path, type };
}

// ---- posts ----
const { data: idRows, error: idErr } = await sb.from("pantweets").select("id").gt("expires_at", new Date().toISOString());
if (idErr) throw idErr;
console.log(`${idRows.length} live posts to check`);

let movedPosts = 0, failed = 0;
for (const { id } of idRows) {
  try {
    const { data: row, error } = await sb.from("pantweets").select("*").eq("id", id).single();
    if (error) throw error;

    let files = Array.isArray(row.files) ? [...row.files] : [];
    if (!files.length && row.file_data) files = [{ data: row.file_data, type: row.file_type, name: row.file_name }];

    if (!files.some((f) => f && f.data && !f.url)) continue; // nothing to move

    const out = [];
    for (const f of files) {
      if (f.url || !f.data) { out.push(f); continue; }
      const up = await upload(f.data, f.type, row.user_id, "posts");
      out.push({ url: up.url, path: up.path, type: up.type, name: f.name || null });
    }
    const { error: uErr } = await sb.from("pantweets")
      .update({ files: out, file_data: null, file_type: null, file_name: null }).eq("id", id);
    if (uErr) throw uErr;
    movedPosts++;
    console.log("moved post", id);
  } catch (e) {
    failed++;
    console.error("FAILED post", id, e.message || e);
  }
}

// ---- avatars ----
const { data: avs, error: avErr } = await sb.from("users").select("id").like("avatar", "data:%");
if (avErr) throw avErr;
let movedAvatars = 0;
for (const { id } of avs) {
  try {
    const { data: u } = await sb.from("users").select("avatar").eq("id", id).single();
    const up = await upload(u.avatar, null, id, "avatar");
    const { error } = await sb.from("users").update({ avatar: up.url }).eq("id", id);
    if (error) throw error;
    movedAvatars++;
    console.log("moved avatar", id);
  } catch (e) {
    failed++;
    console.error("FAILED avatar", id, e.message || e);
  }
}

console.log(`Done. posts moved: ${movedPosts}, avatars moved: ${movedAvatars}, failures: ${failed}`);
