import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, Heart, MessageCircle, Repeat, Volume2, VolumeX, X, LayoutGrid, Clapperboard } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { RichPostText } from "./RichPostText";
import { AuthorBadges, ModBanner } from "./PostParts";
import { usePagedPosts, useNearEnd, queries } from "./postQueries";
import { displayName, fmt, isVideo, same } from "./utils";
import { mediaUrl as mediaSrc } from "./media";
import { useLowData } from "./lowData";

// ---------- one full-screen slide ----------
function Slide({ post, muted, nearEnd, hasMore, loadMore }) {
  const { currentUser } = useAuth();
  const { users, toggleLike, openPost, setRepostTarget, openUserSheet, recordView } = usePosts();
  const boxRef = useRef(null);
  const vidRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const author = { ...(users[post.user_id] || {}), username: users[post.user_id]?.username || post.username };
  const file = post.files[0];
  const video = isVideo(file);
  const liked = post.likes.some((i) => same(i, currentUser.id));
  const { low } = useLowData(); // data saver: no autoplay, no preloading

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, []);

  // play the video that is on screen, pause the rest
  useEffect(() => {
    const v = vidRef.current;
    if (visible) {
      recordView(post);
      if (nearEnd && hasMore) loadMore();
      if (v) { v.muted = muted; if (!low) v.play().catch(() => {}); }
    } else if (v) { v.pause(); v.currentTime = 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(() => { if (vidRef.current) vidRef.current.muted = muted; }, [muted]);

  const btn = "flex flex-col items-center gap-0.5 text-white text-xs font-bold drop-shadow";
  return (
    <div ref={boxRef} className="relative h-full w-full snap-start snap-always shrink-0 bg-black">
      {video ? (
        <video
          ref={vidRef} src={mediaSrc(file)} loop playsInline muted preload={low ? "none" : "metadata"}
          onClick={(e) => { const v = e.currentTarget; if (v.paused) v.play(); else v.pause(); }}
          className="h-full w-full object-contain"
        />
      ) : (
        <img src={mediaSrc(file)} alt="" className="h-full w-full object-contain" />
      )}
      {post.files.length > 1 && (
        <span className="absolute top-14 left-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white">1/{post.files.length}</span>
      )}

      {/* actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <button onClick={() => openUserSheet(post.user_id)} className="rounded-full border-2 border-white"><Avatar user={author} size={44} /></button>
        <button onClick={() => toggleLike(post)} className={btn}>
          <Heart size={28} fill={liked ? "#f87171" : "none"} className={liked ? "text-red-400" : ""} />{fmt(post.likes.length)}
        </button>
        <button onClick={() => openPost(post)} className={btn}><MessageCircle size={28} />{fmt(post.comment_count)}</button>
        <button onClick={() => setRepostTarget(post)} className={btn}><Repeat size={26} />{fmt(post.repost_count || 0)}</button>
      </div>

      {/* author + caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pr-20 pb-6 text-white">
        <p className="font-bold text-sm">{displayName(author)}<AuthorBadges user={author} /> <span className="font-normal opacity-80">@{author.username}</span></p>
        <ModBanner post={post} />
        <RichPostText text={post.content} className="mt-1 text-sm line-clamp-3" />
      </div>
    </div>
  );
}

// ---------- vertical swipe feed (TikTok / Reels style) ----------
function Reels({ list, startIndex = 0, onClose, hasMore, loadMore }) {
  const boxRef = useRef(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => { boxRef.current?.children[startIndex]?.scrollIntoView(); }, [startIndex]);

  return (
    <div className="relative h-full w-full bg-black">
      {onClose && (
        <button onClick={onClose} className="absolute top-3 left-3 z-10 rounded-full bg-black/50 p-2 text-white"><X size={20} /></button>
      )}
      <button onClick={() => setMuted((m) => !m)} className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-2 text-white" title="Sound">
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <div ref={boxRef} className="h-full overflow-y-scroll snap-y snap-mandatory" style={{ scrollbarWidth: "none" }}>
        {list.map((p, i) => (
          <Slide key={p.id} post={p} muted={muted} nearEnd={i >= list.length - 3} hasMore={hasMore} loadMore={loadMore} />
        ))}
      </div>
    </div>
  );
}

// ---------- the page behind the "Box" button ----------
export default function MediaPage({ onBack }) {
  const { t } = useTheme();
  const [tab, setTab] = useState("explore"); // explore | shorts
  const [openAt, setOpenAt] = useState(null);

  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${t.page} ${t.text}`}>
      <header className={`flex items-center gap-2 px-3 py-3 border-b ${t.line}`}>
        <button onClick={onBack} className="p-2 rounded-xl"><ArrowLeft size={20} /></button>
        <h1 className="font-black text-lg flex-1">Media</h1>
        <div className={`flex p-1 rounded-2xl ${t.chip.split(" ")[0]}`}>
          {[["explore", "Explore", LayoutGrid], ["shorts", "Shorts", Clapperboard]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold ${tab === k ? t.accent : t.sub}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {tab === "explore" ? <Explore openAt={openAt} setOpenAt={setOpenAt} /> : <Shorts />}
      </div>
    </div>
  );
}

function Explore({ openAt, setOpenAt }) {
  const { t } = useTheme();
  const { low } = useLowData();
  const { list, loading, hasMore, loadMore } = usePagedPosts(queries.media("all"), "all");
  const end = useRef(null);
  useNearEnd(end, loadMore, hasMore && !loading);
  const media = list.filter((p) => p.files.length);

  return (
    <>
      <div className="h-full overflow-y-auto">
        {!loading && media.length === 0 && <p className={`text-center text-sm py-16 ${t.sub}`}>No photos or videos yet. Be the first to post one!</p>}
        <div className="grid grid-cols-3 gap-0.5">
          {media.map((p, i) => {
            const f = p.files[0];
            return (
              <button key={p.id} onClick={() => setOpenAt(i)} className="relative aspect-square overflow-hidden bg-black/20">
                {isVideo(f)
                  ? (low ? <div className="h-full w-full bg-black/60" /> : <video src={`${mediaSrc(f)}#t=0.1`} muted preload="metadata" className="h-full w-full object-cover" />)
                  : <img src={mediaSrc(f)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                {isVideo(f) && <Play size={16} fill="currentColor" className="absolute top-1.5 right-1.5 text-white drop-shadow" />}
                {p.files.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{p.files.length}</span>}
              </button>
            );
          })}
        </div>
        {hasMore && <div ref={end} className="h-10" />}
        {loading && <p className={`text-center text-xs py-4 ${t.sub}`}>Loading…</p>}
      </div>

      {/* tapping a tile opens the viewer on that item */}
      {openAt != null && (
        <div className="fixed inset-0 z-[45]">
          <Reels list={media} startIndex={openAt} onClose={() => setOpenAt(null)} hasMore={hasMore} loadMore={loadMore} />
        </div>
      )}
    </>
  );
}

function Shorts() {
  const { t } = useTheme();
  const { list, loading, hasMore, loadMore } = usePagedPosts(queries.media("video"), "video");
  const videos = list.filter((p) => p.files.some(isVideo));
  if (!loading && !videos.length) return <p className={`text-center text-sm py-16 ${t.sub}`}>No videos yet.</p>;
  return <Reels list={videos} hasMore={hasMore} loadMore={loadMore} />;
}