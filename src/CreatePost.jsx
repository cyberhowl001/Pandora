import { useRef, useState } from "react";
import { Image, Video, Type, X } from "lucide-react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet } from "./ui";
import { compressImage, fileToMedia, mediaSrc } from "./utils";

const MAX_PHOTOS = 10;
const MAX_IMAGE_MB = 10; // photos are compressed before saving
const MAX_VIDEO_MB = 25;

export default function CreatePost({ onClose }) {
  const { t } = useTheme();
  const { createPost } = usePosts();
  const [type, setType] = useState("text");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const pick = async (e) => {
    const picked = [...e.target.files];
    e.target.value = "";
    if (!picked.length) return;
    setBusy(true);
    try {
      if (type === "image") {
        const out = [];
        for (const f of picked.slice(0, MAX_PHOTOS - files.length)) {
          if (!f.type.startsWith("image/")) { alert("Please choose image files only."); continue; }
          if (f.size > MAX_IMAGE_MB * 1024 * 1024) { alert(`${f.name} is over ${MAX_IMAGE_MB}MB.`); continue; }
          out.push(await compressImage(f));
        }
        setFiles((p) => [...p, ...out]);
      } else {
        const f = picked[0];
        if (!f.type.startsWith("video/")) return alert("Please choose a video file.");
        if (f.size > MAX_VIDEO_MB * 1024 * 1024) return alert(`Video must be under ${MAX_VIDEO_MB}MB.`);
        setFiles([await fileToMedia(f)]);
      }
    } catch {
      alert("Could not read that file.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const err = await createPost({ type, content, files });
    setBusy(false);
    if (err) return setError("Could not post. The file may be too large, or you're offline.");
    onClose();
  };

  const canPost = type === "text" ? content.trim() : files.length;

  return (
    <Sheet title="New PanTweet" onClose={onClose} full={false}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {[["text", <Type size={14} />, "Text"], ["image", <Image size={14} />, "Photos"], ["video", <Video size={14} />, "Video"]].map(([k, icon, label]) => (
            <button
              key={k}
              onClick={() => { setType(k); setFiles([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold ${type === k ? t.accent : `${t.chip} ${t.sub}`}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {type !== "text" && (
          <>
            <div className="flex gap-2 flex-wrap">
              {files.map((f, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/10">
                  {f.type.startsWith("video/")
                    ? <video src={mediaSrc(f)} className="w-full h-full object-cover" />
                    : <img src={mediaSrc(f)} alt="" className="w-full h-full object-cover" />}
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white">
                    <X size={12} />
                  </button>
                </div>
              ))}
              {((type === "image" && files.length < MAX_PHOTOS) || (type === "video" && !files.length)) && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-xs ${t.line} ${t.sub}`}
                >
                  {type === "image" ? <Image size={20} /> : <Video size={20} />}
                  {busy ? "…" : "Add"}
                </button>
              )}
            </div>
            <p className={`text-xs ${t.sub}`}>
              {type === "image" ? `Up to ${MAX_PHOTOS} photos. Viewers slide left / right to see them.` : `One video, max ${MAX_VIDEO_MB}MB.`}
            </p>
            <input
              ref={inputRef} type="file" className="hidden"
              accept={type === "image" ? "image/*" : "video/*"}
              multiple={type === "image"}
              onChange={pick}
            />
          </>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "text" ? "What's on your mind? Use #hashtags" : "Add a caption (optional)…"}
          rows={type === "text" ? 4 : 2}
          className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={submit} disabled={busy || !canPost} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>
          {busy ? "Please wait…" : "Post (lasts 48h)"}
        </button>
      </div>
    </Sheet>
  );
}
