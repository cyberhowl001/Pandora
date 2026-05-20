import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import {
  Heart, Share2, Plus, X, Image, Video, Type,
  ArrowLeft, Rss, Clock, Trash2
} from "lucide-react";

export default function PanTweet({ onBack, isDarkMode }) {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [postType, setPostType] = useState("text"); // 'text' | 'image' | 'video'
  const [content, setContent] = useState("");
  const [fileData, setFileData] = useState(null);
  const [fileType, setFileType] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const dark = isDarkMode;
  const bg = dark ? "bg-[#0d0d0d]" : "bg-[#f5f0ea]";
  const card = dark ? "bg-[#1a1a1a] border-white/5" : "bg-white border-gray-200";
  const text = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const inputCls = dark
    ? "bg-white/5 border-white/10 text-white placeholder-gray-600"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400";

  useEffect(() => {
    loadPosts();

    // Real-time subscription
    const channel = supabase
      .channel("pantweets-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pantweets" }, (payload) => {
        setPosts((prev) => [mapRow(payload.new), ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pantweets" }, (payload) => {
        setPosts((prev) => prev.map((p) => p.id === payload.new.id ? mapRow(payload.new) : p));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pantweets" }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-remove expired posts from UI
  useEffect(() => {
    const interval = setInterval(() => {
      setPosts((prev) => prev.filter((p) => new Date(p.expires_at) > new Date()));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const mapRow = (row) => ({
    id: row.id,
    created_at: row.created_at,
    expires_at: row.expires_at,
    user_id: row.user_id,
    username: row.username,
    avatar_url: row.avatar_url,
    type: row.type,
    content: row.content,
    file_data: row.file_data,
    file_type: row.file_type,
    file_name: row.file_name,
    likes: row.likes || [],
  });

  const loadPosts = async () => {
    const { data } = await supabase
      .from("pantweets")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setPosts((data || []).map(mapRow));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validate video under ~5 min (rough 150MB limit at decent quality)
    if (file.type.startsWith("video/") && file.size > 150 * 1024 * 1024) {
      alert("Video must be under ~5 minutes / 150MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result.split(",")[1]);
      setFileType(file.type);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const createPost = async () => {
    if (postType === "text" && !content.trim()) return;
    if (postType !== "text" && !fileData) return;
    setLoading(true);

    await supabase.from("pantweets").insert([{
      user_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url,
      type: postType,
      content: content.trim() || null,
      file_data: fileData,
      file_type: fileType,
      file_name: fileName,
      likes: [],
    }]);

    setContent("");
    setFileData(null);
    setFileType(null);
    setFileName(null);
    setShowCreate(false);
    setLoading(false);
  };

  const toggleLike = async (post) => {
    const alreadyLiked = post.likes.includes(currentUser.id);
    const newLikes = alreadyLiked
      ? post.likes.filter((id) => id !== currentUser.id)
      : [...post.likes, currentUser.id];

    await supabase.from("pantweets").update({ likes: newLikes }).eq("id", post.id);
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, likes: newLikes } : p));
  };

  const deletePost = async (id) => {
    await supabase.from("pantweets").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const sharePost = (post) => {
    const text = post.content || "Check out this PanTweet!";
    if (navigator.share) {
      navigator.share({ title: `@${post.username} on PanTweet`, text });
    } else {
      navigator.clipboard.writeText(`@${post.username}: ${text}`);
      alert("Copied to clipboard!");
    }
  };

  const timeLeft = (expiresAt) => {
    const ms = new Date(expiresAt) - new Date();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  return (
    <div className={`min-h-screen w-full ${bg} ${text} flex flex-col`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b ${dark ? "bg-[#0d0d0d]/90 border-white/5" : "bg-white/90 border-gray-200"} backdrop-blur`}>
        <button onClick={onBack} className={`p-2 rounded-xl ${dark ? "hover:bg-white/5" : "hover:bg-gray-100"} transition-all`}>
          <ArrowLeft size={18} />
        </button>
        <Rss size={18} className="text-amber-400" />
        <span className="font-black text-lg">PanTweet</span>
        <p className={`text-xs ${sub} hidden sm:block`}>Posts vanish in 24h</p>
        <div className="flex-1" />
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-bold text-sm transition-all"
        >
          <Plus size={16} /> New Post
        </button>
      </header>

      {/* Feed */}
      <div className="flex-1 max-w-xl mx-auto w-full p-4 space-y-4">
        {posts.length === 0 && (
          <div className={`text-center py-16 ${sub}`}>
            <Rss size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold text-sm">No posts yet</p>
            <p className="text-xs opacity-60">Be the first to post something!</p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            onLike={() => toggleLike(post)}
            onShare={() => sharePost(post)}
            onDelete={() => deletePost(post.id)}
            timeLeft={timeLeft(post.expires_at)}
            dark={dark}
            card={card}
            sub={sub}
            text={text}
          />
        ))}
      </div>

      {/* Create Post Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div
            className={`w-full max-w-md rounded-2xl border ${card} ${text} overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${dark ? "border-white/5" : "border-gray-100"}`}>
              <h3 className="font-black">New PanTweet</h3>
              <button onClick={() => setShowCreate(false)} className={`p-1.5 rounded-xl ${dark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Type selector */}
              <div className="flex gap-2">
                {[
                  ["text", <Type size={14} />, "Text"],
                  ["image", <Image size={14} />, "Image"],
                  ["video", <Video size={14} />, "Video"],
                ].map(([type, icon, label]) => (
                  <button
                    key={type}
                    onClick={() => { setPostType(type); setFileData(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      postType === type ? "bg-amber-400 text-black" : `${dark ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-500"}`
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Text area */}
              {postType === "text" && (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={4}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
                />
              )}

              {/* Image / Video picker */}
              {(postType === "image" || postType === "video") && (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer gap-2 transition-all ${
                      fileData ? "border-amber-400" : `${dark ? "border-white/10 hover:border-white/20" : "border-gray-200 hover:border-gray-300"}`
                    }`}
                  >
                    {fileData ? (
                      postType === "image" ? (
                        <img src={`data:${fileType};base64,${fileData}`} alt="" className="h-full object-contain rounded-xl" />
                      ) : (
                        <video src={`data:${fileType};base64,${fileData}`} className="h-full rounded-xl" controls />
                      )
                    ) : (
                      <>
                        {postType === "image" ? <Image size={24} className="text-amber-400/60" /> : <Video size={24} className="text-amber-400/60" />}
                        <p className={`text-xs ${sub}`}>Click to select {postType}</p>
                        {postType === "video" && <p className={`text-xs ${sub} opacity-60`}>Max ~5 minutes</p>}
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={postType === "image" ? "image/*" : "video/*"}
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {/* Caption for image/video */}
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Add a caption (optional)…"
                    rows={2}
                    className={`mt-2 w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
                  />
                </div>
              )}

              <button
                onClick={createPost}
                disabled={loading || (postType === "text" ? !content.trim() : !fileData)}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-50"
              >
                {loading ? "Posting…" : "Post (lasts 24h)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, currentUser, onLike, onShare, onDelete, timeLeft, dark, card, sub, text }) {
  const isOwn = post.user_id === currentUser?.id;
  const liked = post.likes.includes(currentUser?.id);

  return (
    <div className={`rounded-2xl border p-4 ${card}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-sm">
            {post.avatar_url
              ? <img src={post.avatar_url} alt="" className="w-full h-full object-cover" />
              : post.username?.[0]?.toUpperCase() || "?"
            }
          </div>
          <div>
            <p className={`font-bold text-sm ${text}`}>@{post.username}</p>
            <div className={`flex items-center gap-1 text-xs ${sub}`}>
              <Clock size={10} />
              <span>{timeLeft}</span>
            </div>
          </div>
        </div>
        {isOwn && (
          <button onClick={onDelete} className="p-1.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {post.type === "text" && post.content && (
        <p className={`text-sm leading-relaxed ${text} mb-3`}>{post.content}</p>
      )}
      {post.type === "image" && post.file_data && (
        <div className="mb-3">
          <img
            src={`data:${post.file_type};base64,${post.file_data}`}
            alt="post"
            className="w-full rounded-xl max-h-80 object-cover"
          />
          {post.content && <p className={`text-sm mt-2 ${text}`}>{post.content}</p>}
        </div>
      )}
      {post.type === "video" && post.file_data && (
        <div className="mb-3">
          <video
            src={`data:${post.file_type};base64,${post.file_data}`}
            controls
            className="w-full rounded-xl max-h-80"
          />
          {post.content && <p className={`text-sm mt-2 ${text}`}>{post.content}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <button
          onClick={onLike}
          className={`flex items-center gap-1.5 text-sm font-bold transition-all ${
            liked ? "text-red-400" : `${sub} hover:text-red-400`
          }`}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {post.likes.length > 0 && post.likes.length}
        </button>
        <button
          onClick={onShare}
          className={`flex items-center gap-1.5 text-sm font-bold ${sub} hover:text-amber-400 transition-all`}
        >
          <Share2 size={16} /> Share
        </button>
      </div>
    </div>
  );
}