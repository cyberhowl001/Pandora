import { useRef, useState } from "react";
import { Image, Video, Type, X, BarChart3, Newspaper, Plus } from "lucide-react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet } from "./ui";
import { compressImage, fileToMedia, mediaSrc } from "./utils";

const MAX_PHOTOS = 10;
const MAX_IMAGE_MB = 10; // photos are compressed before saving
const MAX_VIDEO_MB = 25;
const MAX_OPTIONS = 4;

const TYPES = [
  ["text", Type, "Text"], ["image", Image, "Photos"], ["video", Video, "Video"],
  ["poll", BarChart3, "Poll"], ["news", Newspaper, "News"],
];

export default function CreatePost({ onClose }) {
  const { t } = useTheme();
  const { createPost } = usePosts();
  const [type, setType] = useState("text");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [options, setOptions] = useState(["", ""]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const media = type === "image" || type === "video";

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

  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const validUrl = /^https?:\/\/\S+\.\S+/i.test(sourceUrl.trim());

  const canPost =
    type === "text" ? content.trim()
    : media ? files.length
    : type === "poll" ? content.trim() && cleanOptions.length >= 2
    : content.trim() && validUrl;

  const submit = async () => {
    setBusy(true);
    setError("");
    const payload =
      type === "poll" ? { type: "text", kind: "poll", content, poll: { options: cleanOptions.slice(0, MAX_OPTIONS) } }
      : type === "news" ? { type: "text", kind: "news", content, source_url: sourceUrl.trim() }
      : { type, content, files };
    const err = await createPost(payload);
    setBusy(false);
    if (err) {
      return setError(String(err?.message || "").includes("rate_limited")
        ? "You are posting too fast. Please wait a while and try again."
        : "Could not post. The file may be too large, or you're offline.");
    }
    onClose();
  };

  const placeholder =
    type === "text" ? "What's on your mind? Use #hashtags"
    : type === "poll" ? "Ask a question…"
    : type === "news" ? "Headline or short summary of the news…"
    : "Add a caption (optional)…";

  return (
    <Sheet title="New PanTweet" onClose={onClose} full={false}>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {TYPES.map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => { setType(k); setFiles([]); setError(""); }}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold ${type === k ? t.accent : `${t.chip} ${t.sub}`}`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {media && (
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
              {type === "image" ? `Up to ${MAX_PHOTOS} photos. Viewers slide left / right to see them.` : `One video, max ${MAX_VIDEO_MB}MB. It also appears in Shorts.`}
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
          placeholder={placeholder}
          rows={type === "text" ? 4 : 2}
          className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`}
        />

        {type === "poll" && (
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={o} maxLength={60}
                  onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${i + 1}`}
                  className={`flex-1 border rounded-xl px-3 py-2 text-sm outline-none ${t.input}`}
                />
                {options.length > 2 && (
                  <button onClick={() => setOptions((p) => p.filter((_, j) => j !== i))} className={`p-1 ${t.sub}`}><X size={16} /></button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <button onClick={() => setOptions((p) => [...p, ""])} className={`flex items-center gap-1 text-xs font-bold ${t.accentText}`}>
                <Plus size={14} /> Add option
              </button>
            )}
            <p className={`text-xs ${t.sub}`}>Voting stays open while the post is live (48h).</p>
          </div>
        )}

        {type === "news" && (
          <div className="space-y-1.5">
            <input
              value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} type="url"
              placeholder="Link to the original source (https://…)"
              className={`w-full border rounded-xl px-3 py-2 text-sm outline-none ${t.input}`}
            />
            <p className={`text-xs ${t.sub}`}>News posts must link their source. Only verified publishers get a verified label; everyone else is shown as unverified.</p>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={submit} disabled={busy || !canPost} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>
          {busy ? "Please wait…" : "Post (lasts 48h)"}
        </button>
      </div>
    </Sheet>
  );
}
