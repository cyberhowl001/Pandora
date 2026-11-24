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