import { useRef, useState } from "react";
import {
  Heart, MessageCircle, Repeat, Eye, Bookmark, MoreVertical, Clock, Trash2,
  ChevronLeft, ChevronRight, Activity,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar, useReveal, revealClass } from "./ui";
import { RichPostText } from "./RichPostText";
import { useLowData } from "./lowData";
import { AuthorBadges, ModBanner, SourceLabel, PollBlock } from "./PostParts";
import { displayName, fmt, timeLeft, isVideo, same } from "./utils";
import { mediaUrl as mediaSrc } from "./media";

// one photo / video. With data saver on it loads only after a tap, and videos never preload.
function MediaItem({ f, contain }) {
  const { low } = useLowData();
  const [load, setLoad] = useState(false);
  const [broken, setBroken] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const video = isVideo(f);
  if (low && !load) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setLoad(true); }}
        className="grid h-full w-full place-items-center bg-black/10 text-center"
      >
        <span className="text-sm font-bold">{video ? "▶ Tap to load video" : "Tap to load photo"}</span>
        <span className="text-xs opacity-60">Data saver is on</span>
      </button>
    );
  }
  // if the file cannot be loaded, say so (and log the address, so the cause can be found) instead of a broken icon
  const base = mediaSrc(f);
  const src = attempt && f.url ? `${base}?r=${attempt}` : base;
  const onBad = (e) => {
    console.error("[media] could not load:", (e.currentTarget.currentSrc || e.currentTarget.src || "(empty)").slice(0, 300), "file object:", f);
    setBroken(true);
  };
  if (broken) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setBroken(false); setAttempt((n) => n + 1); }}
        className="grid h-full w-full place-items-center bg-black/10 text-center"
      >
        <span className="text-sm font-bold">Could not load this {video ? "video" : "photo"}</span>
        <span className="text-xs opacity-60">Tap to try again</span>
      </button>
    );
  }
  return video ? (
    <video src={src} controls preload="metadata" onError={onBad} onClick={(e) => e.stopPropagation()} className="w-full h-full object-contain bg-black" />
  ) : (
    <img src={src} alt="" loading="lazy" decoding="async" onError={onBad} className={`w-full h-full ${contain ? "object-contain" : "object-cover"}`} />
  );
}

// ---------- Left / right slider for posts with more than one photo ----------
export function MediaSlider({ files, contain = false, heightClass = "h-64" }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  if (!files?.length) return null;
  const multi = files.length > 1;
  const step = () => (ref.current?.children[0]?.offsetWidth || 0) + 8;

  const onScroll = () => {
    const s = step();
    if (s) setIdx(Math.min(files.length - 1, Math.round(ref.current.scrollLeft / s)));
  };
  const go = (e, dir) => {
    e.stopPropagation();
    ref.current?.scrollBy({ left: dir * step(), behavior: "smooth" });
  };

  return (
    <div className="relative mb-3">
      <style>{`.pandora-noscroll::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={ref}
        onScroll={onScroll}
        className="pandora-noscroll flex gap-2 overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none" }}
      >
        {files.map((f, i) => (
          <div key={i} className={`snap-start shrink-0 ${multi ? "w-[85%]" : "w-full"} ${heightClass} rounded-xl overflow-hidden bg-black/10`}>
            <MediaItem f={f} contain={contain} />
          </div>
        ))}
      </div>
      {multi && (
        <>
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-bold">
            {idx + 1}/{files.length}
          </span>
          {idx > 0 && (
            <button onClick={(e) => go(e, -1)} className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white">
              <ChevronLeft size={16} />
            </button>
          )}
          {idx < files.length - 1 && (
            <button onClick={(e) => go(e, 1)} className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white">
              <ChevronRight size={16} />
            </button>
          )}
          <div className="flex justify-center gap-1 mt-2">
            {files.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-gray-500" : "w-1.5 bg-gray-300"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Reference to the original post on a re-post ----------
export function RepostRef({ refPost }) {
  const { t } = useTheme();
  const { users } = usePosts();
  const author = { ...(users[refPost.user_id] || {}), username: users[refPost.user_id]?.username || refPost.username };
  return (
    <div className={`mb-3 rounded-xl border p-3 ${t.line} ${t.dark ? "bg-white/5" : "bg-black/[0.03]"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar user={author} size={22} />
        <span className="font-bold text-xs">{displayName(author)}</span>
        <span className={`text-xs ${t.sub}`}>@{author.username}</span>
      </div>
      <RichPostText text={refPost.content} className="text-sm" />
      {refPost.image && <img src={mediaSrc(refPost.image)} alt="" className="mt-2 w-full max-h-48 object-cover rounded-lg" />}
      {refPost.has_video && <p className={`mt-1 text-xs ${t.sub}`}>🎬 Video in the original post</p>}
    </div>
  );
}

// ---------- Author header + text + media (used by card and sheet) ----------
export function PostBody({ post, inSheet = false, onDelete }) {
  const { currentUser } = useAuth();
  const { t } = useTheme();
  const { users, now, openPostMenu, openUserSheet } = usePosts();
  const author = { ...(users[post.user_id] || {}), username: users[post.user_id]?.username || post.username };
  const isOwn = same(post.user_id, currentUser?.id);
  return (
    <>
      {post.repost_of && (
        <p className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${t.sub}`}>
          <Repeat size={12} /> {displayName(author)} reposted
        </p>
      )}
      <div className="flex items-start gap-2.5 mb-2">
        {/* tap the photo: user sheet slides up from the bottom */}
        <button
          onClick={(e) => { e.stopPropagation(); openUserSheet(post.user_id); }}
          className="shrink-0 rounded-full"
          title="View profile"
        >
          <Avatar user={author} size={40} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate">
            <span className="font-bold text-sm">{displayName(author)}</span><AuthorBadges user={author} />{" "}
            <span className={`text-xs ${t.sub}`}>@{author.username}</span>
          </p>
          <div className={`flex items-center gap-1 text-xs ${t.sub}`}>
            <Clock size={10} /> <span>{timeLeft(post.expires_at, now)}</span>
          </div>
        </div>
        {inSheet && isOwn && onDelete && (
          <button onClick={onDelete} className="p-1.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10">
            <Trash2 size={16} />
          </button>
        )}
        {/* 3 dots: view interactions, report post, report user, follow / unfollow */}
        <button
          onClick={(e) => { e.stopPropagation(); openPostMenu(post); }}
          className="p-1 text-violet-500"
        >
          <MoreVertical size={18} />
        </button>
      </div>
      <ModBanner post={post} />
      <RichPostText text={post.content} className="text-[15px] leading-relaxed mb-3" />
      <SourceLabel post={post} author={author} />
      <PollBlock post={post} />
      {post.repost_of && <RepostRef refPost={post.repost_of} />}
      <MediaSlider files={post.files} contain={inSheet} heightClass={inSheet ? "h-72" : "h-64"} />
    </>
  );
}

// ---------- like / comment / in-app repost / views / bookmark ----------
export function ActionBar({ post }) {
  const { currentUser } = useAuth();
  const { t } = useTheme();
  const { toggleLike, toggleBookmark, isBookmarked, repostCountOf, openPost, setRepostTarget, now } = usePosts();
  const liked = post.likes.some((i) => same(i, currentUser?.id));
  const saved = isBookmarked(post.id);
  const expired = new Date(post.expires_at).getTime() <= now;
  const btn = "flex items-center gap-1.5 text-sm font-semibold transition-all disabled:opacity-40";
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
  return (
    <div className={`flex items-center gap-4 pt-2 border-t ${t.line}`}>
      <button disabled={expired} onClick={stop(() => toggleLike(post))} className={`${btn} ${liked ? "text-red-400" : "text-violet-500 hover:text-red-400"}`}>
        <Heart size={18} fill={liked ? "currentColor" : "none"} /> {fmt(post.likes.length)}
      </button>
      <button onClick={stop(() => openPost(post))} className={`${btn} text-violet-500`}>
        <MessageCircle size={18} /> {fmt(post.comment_count)}
      </button>
      <button disabled={expired} onClick={stop(() => setRepostTarget(post))} className={`${btn} text-violet-500`}>
        <Repeat size={18} /> {fmt(repostCountOf(post.id))}
      </button>
      <span className={`${btn} text-violet-500`}><Eye size={18} /> {fmt(post.views.length)}</span>
      <div className="flex-1" />
      <button onClick={stop(() => toggleBookmark(post))} className={`${btn} text-violet-500`}>
        <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function PostCard({ post }) {
  const { t } = useTheme();
  const { openPost, interactionsOf } = usePosts();
  const [ref, shown] = useReveal();
  return (
    <div ref={ref} onClick={() => openPost(post)} className={`rounded-2xl border p-4 cursor-pointer ${revealClass(shown)} ${t.card}`}>
      <PostBody post={post} />
      <ActionBar post={post} />
      <button
        onClick={(e) => { e.stopPropagation(); openPost(post); }}
        className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${t.accentSoft}`}
      >
        <Activity size={12} /> {fmt(interactionsOf(post))} interactions
      </button>
    </div>
  );
}

export function PostList({ posts, empty = "Nothing here yet" }) {
  const { t } = useTheme();
  if (!posts.length) return <p className={`text-center text-sm py-12 ${t.sub}`}>{empty}</p>;
  return <div className="space-y-4">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>;
}