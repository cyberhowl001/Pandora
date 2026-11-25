import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Repeat, Volume2, VolumeX, Play } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useLowData } from "./lowData";
import { Avatar } from "./ui";
import { RichPostText } from "./RichPostText";
import { AuthorBadges, ModBanner, Watermark } from "./PostParts";
import { usePagedPosts } from "./postQueries";
import { displayName, fmt, isVideo, same } from "./utils";
import { mediaUrl as mediaSrc } from "./media";

// One full-screen video.
//  - Data saver OFF: plays by itself while it fills the screen, pauses when you scroll away.
//  - Data saver ON : the first frame is shown but nothing plays until you tap the video.
function Slide({ post, muted, onMute, nearEnd, hasMore, loadMore }) {
  const { currentUser } = useAuth();
  const { users, toggleLike, openPost, setRepostTarget, openUserSheet, recordView } = usePosts();
  const { on: saver } = useLowData();
  const boxRef = useRef(null);
  const vidRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(true);

  const author = { ...(users[post.user_id] || {}), username: users[post.user_id]?.username || post.username };
  const file = post.files.find(isVideo);
  const liked = post.likes.some((i) => same(i, currentUser.id));

  // "on screen" = at least 60% of the slide is visible
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

  // turning data saver on while a video plays stops it
  useEffect(() => { if (saver) vidRef.current?.pause(); }, [saver]);

  const toggle = () => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const btn = "flex flex-col items-center gap-0.5 text-white text-xs font-bold drop-shadow";
  return (
    <div ref={boxRef} className="relative h-full w-full shrink-0 snap-start snap-always bg-black">
      <video
        ref={vidRef}
        src={`${mediaSrc(file)}${saver ? "#t=0.1" : ""}`}
        loop playsInline muted preload="metadata"
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
        onClick={toggle}
        className="h-full w-full object-contain"
      />
      <Watermark file={file} pos="top-center" />

      {paused && visible && (
        <button onClick={toggle} className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
          <Play size={28} fill="currentColor" />
        </button>
      )}

      {/* actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        <button onClick={() => openUserSheet(post.user_id)} className="rounded-full border-2 border-white"><Avatar user={author} size={44} /></button>
        <button onClick={() => toggleLike(post)} className={btn}>
          <Heart size={28} fill={liked ? "#f87171" : "none"} className={liked ? "text-red-400" : ""} />{fmt(post.likes.length)}
        </button>
        <button onClick={() => openPost(post)} className={btn}><MessageCircle size={28} />{fmt(post.comment_count)}</button>
        <button onClick={() => setRepostTarget(post)} className={btn}><Repeat size={26} />{fmt(post.repost_count || 0)}</button>
        <button onClick={onMute} className={btn} title="Sound">{muted ? <VolumeX size={26} /> : <Volume2 size={26} />}</button>
      </div>

      {/* author + caption */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pr-20 pb-24 text-white">
        <p className="pointer-events-auto font-bold text-sm">
          {displayName(author)}<AuthorBadges user={author} /> <span className="font-normal opacity-80">@{author.username}</span>
        </p>
        <ModBanner post={post} />
        <RichPostText text={post.content} className="pointer-events-auto mt-1 text-sm line-clamp-3" />
      </div>
    </div>
  );
}

// Vertical swipe feed. `load` / `loadKey` work like usePagedPosts(load, key).
export default function VibesFeed({ load, loadKey, empty, muted, onMute }) {
  const { list, loading, hasMore, loadMore } = usePagedPosts(load, loadKey);
  const videos = list.filter((p) => p.files?.some(isVideo));

  if (!videos.length) {
    return (
      <div className="grid h-full place-items-center px-8 text-center text-sm text-white/70">
        {loading ? "Loading…" : empty}
      </div>
    );
  }
  return (
    <div className="h-full snap-y snap-mandatory overflow-y-scroll [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
      {videos.map((p, i) => (
        <Slide key={p.id} post={p} muted={muted} onMute={onMute} nearEnd={i >= videos.length - 3} hasMore={hasMore} loadMore={loadMore} />
      ))}
    </div>
  );
}
