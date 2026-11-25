import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Repeat, Volume2, VolumeX, Play, Search, Smile } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useLowData } from "./lowData";
import { Avatar } from "./ui";
import { RichPostText } from "./RichPostText";
import { AuthorBadges, ModBanner, Watermark } from "./PostParts";
import { usePagedPosts } from "./postQueries";
import { displayName, fmt, isVideo, same } from "./utils";
import { mediaUrl as mediaSrc } from "./media";

const glass = "grid h-12 w-12 place-items-center rounded-full bg-white/30 text-white backdrop-blur-md";

// One video card.
//  - Data saver OFF: plays by itself while it fills the card, pauses when you scroll away.
//  - Data saver ON : the first frame is shown but nothing plays until you tap the video.
function Slide({ post, muted, onMute, nearEnd, hasMore, loadMore }) {
  const { currentUser } = useAuth();
  const { users, toggleLike, openPost, setRepostTarget, openUserSheet, recordView } = usePosts();
  const { on: saver } = useLowData();
  const boxRef = useRef(null);
  const vidRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(true);
  const [wide, setWide] = useState(false); // landscape videos are shown whole, not cropped

  const author = { ...(users[post.user_id] || {}), username: users[post.user_id]?.username || post.username };
  const file = post.files.find(isVideo);
  const liked = post.likes.some((i) => same(i, currentUser.id));

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = vidRef.current;
    if (visible) {
      recordView(post);
      if (nearEnd && hasMore) loadMore();
      if (v) { v.muted = muted; if (!saver) v.play().catch(() => {}); }
    } else if (v) {
      v.pause();
      v.currentTime = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => { if (vidRef.current) vidRef.current.muted = muted; }, [muted]);
  useEffect(() => { if (saver) vidRef.current?.pause(); }, [saver]);

  const toggle = () => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const count = "mt-0.5 text-[11px] font-bold text-white drop-shadow";
  return (
    <div ref={boxRef} className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden bg-black">
      <video
        ref={vidRef}
        src={`${mediaSrc(file)}${saver ? "#t=0.1" : ""}`}
        loop playsInline muted preload="metadata"
        onLoadedMetadata={(e) => setWide(e.currentTarget.videoWidth > e.currentTarget.videoHeight)}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
        onClick={toggle}
        className={`h-full w-full ${wide ? "object-contain" : "object-cover"}`}
      />

      {/* author, top left */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex items-center gap-2.5 bg-gradient-to-b from-black/50 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <button onClick={() => openUserSheet(post.user_id)} className="pointer-events-auto rounded-full"><Avatar user={author} size={40} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-black leading-tight drop-shadow">{displayName(author)}<AuthorBadges user={author} /></p>
          <p className="truncate text-sm opacity-85">@{author.username}</p>
        </div>
        <button onClick={() => openUserSheet(post.user_id)} className={`pointer-events-auto ${glass}`} title="View profile"><Search size={20} /></button>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-[76px] h-8"><Watermark file={file} /></div>

      {paused && visible && (
        <button onClick={toggle} className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
          <Play size={28} fill="currentColor" />
        </button>
      )}

      {/* actions, right side */}
      <div className="absolute bottom-24 right-3 z-[2] flex flex-col items-center gap-3">
        <div className="flex flex-col items-center">
          <button onClick={() => toggleLike(post)} className={glass}>
            <Heart size={22} fill={liked ? "#f87171" : "currentColor"} className={liked ? "text-red-400" : ""} />
          </button>
          <span className={count}>{fmt(post.likes.length)}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => openPost(post)} className={glass}><MessageCircle size={22} fill="currentColor" /></button>
          <span className={count}>{fmt(post.comment_count)}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => setRepostTarget(post)} className={glass}><Repeat size={22} /></button>
          <span className={count}>{fmt(post.repost_count || 0)}</span>
        </div>
        <button onClick={onMute} className={glass} title="Sound">{muted ? <VolumeX size={22} /> : <Volume2 size={22} />}</button>
      </div>

      {/* caption + comment bar, bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-12 pt-16 pr-[4.5rem] text-white">
        <ModBanner post={post} />
        <RichPostText text={post.content} className="pointer-events-auto line-clamp-2 text-sm font-semibold" />
        <button
          onClick={() => openPost(post)}
          className="pointer-events-auto mt-2 flex w-full items-center justify-between rounded-full bg-white/30 px-4 py-3 text-left text-sm font-bold backdrop-blur-md"
        >
          Comment <Smile size={18} />
        </button>
      </div>
    </div>
  );
}

// Vertical swipe list. `load` / `loadKey` work like usePagedPosts(load, key).
export default function VibesFeed({ load, loadKey, empty, muted, onMute, onActivity }) {
  const { list, loading, hasMore, loadMore } = usePagedPosts(load, loadKey);
  const videos = list.filter((p) => p.files?.some(isVideo));

  if (!videos.length) {
    return (
      <div className="grid h-full place-items-center bg-gradient-to-b from-violet-900/70 to-black px-8 text-center text-sm text-white/80">
        {loading ? "Loading…" : empty}
      </div>
    );
  }
  return (
    <div
      onScroll={(e) => { if (e.currentTarget.scrollTop > 30) onActivity?.(); }}
      className="h-full snap-y snap-mandatory overflow-y-scroll [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: "none" }}
    >
      {videos.map((p, i) => (
        <Slide key={p.id} post={p} muted={muted} onMute={onMute} nearEnd={i >= videos.length - 3} hasMore={hasMore} loadMore={loadMore} />
      ))}
    </div>
  );
}
