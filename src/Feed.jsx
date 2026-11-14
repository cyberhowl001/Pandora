import { useEffect, useMemo, useRef, useState } from "react";
import { MoreVertical, Repeat } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar, RichText } from "./ui";
import { MediaSlider, RepostRef, ActionBar } from "./PostCard";
import { displayName, timeAgo, same } from "./utils";

const PAGE = 8;                        // posts that load in each step
const LOAD_DELAY = 350;                // ms the skeleton shows before more posts are added
const SWIPE_X = 90;                    // swipe left this far (px) to refresh the whole feed
const SWIPE_Y = 50;                    // max vertical drift allowed during that swipe
const PULL_Y = 70;                     // pull down this far at the top to load newer posts
const TOP_DELAY = 500;                 // ms spinner shows before newer posts appear at the top
const FEED_TTL = 6 * 60 * 60 * 1000;   // how long shown content is kept after the user leaves (6 hours)
const KEEP_MAX = 60;                   // max shown posts saved on the device

const timeOf = (p) => new Date(p.created_at).getTime();

// current scroll direction, updated by the feed's scroll listener
let scrollDir = "down";

// ---------- saved feed state (kept in memory AND on this device, with an expiry) ----------
// snapshot: time of the newest post in the feed   count: how many posts are loaded
// revealed: ids of posts that already appeared (they never animate again)
// kept:     the posts that were shown, so they stay even if the server stops returning them
// savedAt:  last time the user was in the feed (the expiry counts from here)
const KEY = (uid) => `pandora_feed_state_${uid}`;
const cache = new Map();

const freshState = () => ({ snapshot: null, count: PAGE, revealed: new Set(), kept: new Map(), savedAt: Date.now() });
const expired = (s) => Date.now() - s.savedAt > FEED_TTL;

function getState(uid) {
  const k = String(uid);
  const cached = cache.get(k);
  if (cached && !expired(cached)) return cached;

  let s = freshState();
  if (!cached) {
    // not in memory yet (page was reloaded): try the device
    try {
      const raw = JSON.parse(localStorage.getItem(KEY(uid)));
      if (raw && Date.now() - (raw.savedAt || 0) <= FEED_TTL) {
        s = {
          snapshot: raw.snapshot ?? null,
          count: raw.count || PAGE,
          revealed: new Set(raw.revealed || []),
          kept: new Map((raw.kept || []).map((p) => [String(p.id), p])),
          savedAt: raw.savedAt,
        };
      } else if (raw) {
        localStorage.removeItem(KEY(uid)); // expired
      }
    } catch { /* ignore */ }
  } else {
    try { localStorage.removeItem(KEY(uid)); } catch { /* ignore */ }
  }
  cache.set(k, s);
  return s;
}

let saveTimer;
function persist(uid, now = false) {
  clearTimeout(saveTimer);
  const write = () => {
    const s = getState(uid);
    s.savedAt = Date.now(); // the expiry restarts from the last activity
    try {
      localStorage.setItem(KEY(uid), JSON.stringify({
        snapshot: s.snapshot,
        count: s.count,
        savedAt: s.savedAt,
        revealed: [...s.revealed].slice(-500),
        kept: [...s.kept.values()].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, KEEP_MAX),
      }));
    } catch { /* storage full or blocked */ }
  };
  if (now) write();
  else saveTimer = setTimeout(write, 300);
}

function markRevealed(uid, id) {
  const s = getState(uid);
  const key = String(id);
  if (s.revealed.has(key)) return;
  s.revealed.add(key);
  persist(uid);
}

// Don't treat a swipe as "refresh" when it starts inside a horizontal slider
const blocksSwipe = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.dataset && n.dataset.swipeLock !== undefined) return true;
    if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
  }
  return false;
};

// Scrolling DOWN: the card is shown before it reaches the screen (no animation).
// Scrolling UP: the card slides in from above once it is on screen.
function useRevealOnce(onShow) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ioDown, ioUp;
    const done = (fast) => {
      setInstant(fast);
      setOn(true);
      onShow?.();
      ioDown.disconnect();
      ioUp.disconnect();
    };
    ioDown = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && scrollDir === "down") done(true); },
      { rootMargin: "0px 0px 300px 0px" }
    );
    ioUp = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && scrollDir === "up") done(false); },
      { rootMargin: "-8% 0px 0px 0px" }
    );
    ioDown.observe(el);
    ioUp.observe(el);
    return () => { ioDown.disconnect(); ioUp.disconnect(); };
  }, []);
  return [ref, on, instant];
}

const FeedSkeleton = () => <div className="h-72 w-full animate-pulse rounded-3xl bg-slate-400/20" />;

function FeedCard({ post }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users, openPost, openPostMenu, now } = usePosts();
  const uid = currentUser.id;
  // posts that already appeared before are shown immediately, with no animation
  const [wasSeen] = useState(() => getState(uid).revealed.has(String(post.id)));
  const [ref, reveal, instant] = useRevealOnce(() => markRevealed(uid, post.id));
  const shown = wasSeen || reveal;
  const author = { ...(users[post.user_id] || {}), username: users[post.user_id]?.username || post.username };
  const textOnly = !post.files.length && !post.repost_of;

  return (
    <div
      ref={ref}
      onClick={() => openPost(post)}
      className={`rounded-3xl p-3 overflow-hidden cursor-pointer shadow-sm border ${
        wasSeen || instant ? "" : "transition-all duration-700 ease-out motion-reduce:transition-none"
      } ${shown ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"} ${t.card}`}
    >


      <div className="flex items-center gap-2 px-1 mb-2">
        <Avatar user={author} size={30} />
        <div className="flex-1 min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
             <span className="text-xs font-semibold truncate">{displayName(author)}</span>
                {author.username && displayName(author) !== author.username && (
            <p className={`text-xs truncate ${t.sub}`}>@{author.username}</p>
          )}
      
          </div>
        <span className={`text-xs ${t.sub}`}>· {timeAgo(post.created_at, now)}</span>
        </div>
       
        <div className="flex-1" />
        {/* 3 dots: view interactions, report post, report user, follow / unfollow */}
        <button
          onClick={(e) => { e.stopPropagation(); openPostMenu(post); }}
          className="p-1 text-violet-500 cursor-pointer"
        >
          <MoreVertical size={18} />
        </button>
      </div>
      {post.repost_of && (
        <p className={`flex items-center gap-1.5 text-xs font-semibold mb-2 px-1 ${t.sub}`}>
          <Repeat size={12} /> {displayName(author)} reposted
        </p>
      )}

      {/* picture first, like Discover */}
      <MediaSlider files={post.files} heightClass="h-60" />
      {post.repost_of && <RepostRef refPost={post.repost_of} />}

      {/* headline */}
      {textOnly ? (
        post.content && (
          <div className="rounded-2xl p-5 mb-2">
            <RichText text={post.content} className="text-xl font-bold leading-snug line-clamp-6" />
          </div>
        )
      ) : (
        <RichText text={post.content} className="text-[17px] font-semibold leading-snug line-clamp-3 px-1 mb-3" />
      )}

      <div className="px-1"><ActionBar post={post} /></div>
    </div>
  );
}

export default function Feed({ error }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { posts, refresh } = usePosts(); // `refresh` is optional: used only if PostsContext provides it
  const uid = currentUser.id;
  const st = getState(uid);

  const [snapshot, setSnapshot] = useState(() => st.snapshot); // newest post time in the feed
  const [count, setCount] = useState(() => st.count);          // posts loaded so far
  const [loadingMore, setLoadingMore] = useState(false);       // loading older posts (bottom)
  const [loadingTop, setLoadingTop] = useState(false);         // loading newer posts (top)
  const [refreshing, setRefreshing] = useState(false);
  const [round, setRound] = useState(0);                       // changes on a full refresh
  const topRef = useRef(null);
  const sentinelRef = useRef(null);
  const touch = useRef(null);
  const topBusy = useRef(false);
  const moreTimer = useRef();
  const latest = useRef({});
  const loadNewerRef = useRef(() => {});
  latest.current = { posts, snapshot };

  // keep the saved copy up to date
  useEffect(() => { st.snapshot = snapshot; persist(uid); }, [snapshot, st, uid]);
  useEffect(() => { st.count = count; persist(uid); }, [count, st, uid]);

  // save right away when the user leaves (route change, tab hidden or closed).
  // The expiry time starts counting from this moment.
  useEffect(() => {
    const flush = () => persist(uid, true);
    const onHide = () => { if (document.hidden) flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      clearTimeout(moreTimer.current);
      flush();
    };
  }, [uid]);

  const getMain = () => topRef.current?.closest("main");
  const toTop = () => getMain()?.scrollTo({ top: 0, behavior: "smooth" });

  // track the scroll direction (cards use it to decide how to appear)
  useEffect(() => {
    const main = getMain();
    if (!main) return;
    let last = main.scrollTop;
    const onScroll = () => {
      const y = main.scrollTop;
      if (y > last + 2) scrollDir = "down";
      else if (y < last - 2) scrollDir = "up";
      last = y;
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  // first start: the feed begins at the newest post that exists right now
  useEffect(() => {
    if (snapshot === null && posts.length > 0) setSnapshot(Math.max(...posts.map(timeOf)));
  }, [snapshot, posts]);

  const limit = snapshot ?? Infinity;

  // newest first. Posts that were already shown stay (from the saved copy) even if
  // the server no longer returns them. Fresh data from `posts` wins over the saved copy.
  const live = useMemo(() => {
    const byId = new Map(st.kept);
    posts.forEach((p) => byId.set(String(p.id), p));
    return [...byId.values()]
      .filter((p) => same(p.user_id, uid) || timeOf(p) <= limit)
      .sort((a, b) => timeOf(b) - timeOf(a));
  }, [posts, uid, limit, st]);
  const pending = posts.filter((p) => !same(p.user_id, uid) && timeOf(p) > limit).length;

  const visible = useMemo(() => live.slice(0, count), [live, count]);
  const hasMore = count < live.length;

  // remember every post that is on screen so it is still there when the user comes back
  useEffect(() => {
    let changed = false;
    visible.forEach((p) => {
      const k = String(p.id);
      if (st.kept.get(k) !== p) { st.kept.set(k, p); changed = true; }
    });
    if (changed) persist(uid);
  }, [visible, st, uid]);

  // NEWER posts: appear at the top (a few at a time) when the user scrolls up to the top
  const loadNewer = () => {
    if (topBusy.current) return;
    const { posts: ps, snapshot: snap } = latest.current;
    const lim = snap ?? Infinity;
    const newer = ps
      .filter((p) => !same(p.user_id, uid) && timeOf(p) > lim)
      .sort((a, b) => timeOf(a) - timeOf(b)); // the ones right above the feed first
    if (!newer.length) return;
    scrollDir = "up"; // newer posts slide in from above
    topBusy.current = true;
    setLoadingTop(true);
    setTimeout(() => {
      const batch = newer.slice(0, PAGE);
      setSnapshot(timeOf(batch[batch.length - 1]));
      setCount((c) => c + batch.length);
      setLoadingTop(false);
      topBusy.current = false;
    }, TOP_DELAY);
  };
  loadNewerRef.current = loadNewer;

  // reaching the top while scrolling up loads newer posts
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadNewerRef.current(); });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // full refresh (swipe left, or the Refresh button): the user asked to start again,
  // so the saved posts are cleared on purpose
  const refreshFeed = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await refresh?.(); } catch { /* ignore */ }
    st.revealed.clear(); // everything animates in fresh after a refresh
    st.kept.clear();
    persist(uid);
    topBusy.current = false;
    setLoadingTop(false);
    setSnapshot(null);
    setCount(PAGE);
    setRound((r) => r + 1);
    toTop();
    setTimeout(() => setRefreshing(false), 500);
  };

  const onTouchStart = (e) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, locked: blocksSwipe(e.target) };
  };
  const onTouchEnd = (e) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (!s.locked && dx < -SWIPE_X && Math.abs(dy) < SWIPE_Y) return refreshFeed(); // swipe left
    const main = getMain();
    if (dy > PULL_Y && Math.abs(dx) < SWIPE_Y && (!main || main.scrollTop <= 0)) loadNewer(); // pull down at the top
  };
  const onWheel = (e) => {
    const main = getMain();
    if (e.deltaY < 0 && (!main || main.scrollTop <= 0)) loadNewer(); // mouse wheel up at the top
  };

  // OLDER posts: the next batch loads 700px before the bottom, so it is ready before you get there
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setLoadingMore(true);
      moreTimer.current = setTimeout(() => {
        setCount((c) => c + PAGE);
        setLoadingMore(false);
      }, LOAD_DELAY);
    }, { rootMargin: "0px 0px 700px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, count]);

  return (
    <div
      className="feed-root p-3 space-y-4 overflow-x-clip"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      <style>{`
        .feed-root, .feed-root * { scrollbar-width: none; -ms-overflow-style: none; }
        .feed-root::-webkit-scrollbar, .feed-root *::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>

      <div ref={topRef} className="h-px" />
      {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

      {(refreshing || loadingTop) && (
        <div className="flex justify-center py-2">
          <div className="w-6 h-6 rounded-full border-[3px] border-violet-500/30 border-t-violet-500 animate-spin" />
        </div>
      )}

      {pending > 0 && !refreshing && !loadingTop && (
        <div className="sticky top-1 z-10 flex justify-center">
          <button
            onClick={() => { toTop(); loadNewer(); }}
            className="px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg bg-linear-to-r from-violet-600 to-blue-600"
          >
            ↑ {pending} new {pending === 1 ? "post" : "posts"}
          </button>
        </div>
      )}

      {visible.length === 0 && !error && (
        <p className={`text-center text-sm py-12 ${t.sub}`}>No posts yet. Be the first to post something!</p>
      )}

      {visible.map((p) => (
        <FeedCard key={`${round}-${p.id}`} post={p} />
      ))}

      {hasMore && (
        <>
          {loadingMore && <FeedSkeleton />}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}

      {!hasMore && visible.length > 0 && (
        <div className="text-center py-8">
          <p className={`text-sm mb-3 ${t.sub}`}>You're all caught up</p>
          <button
            onClick={refreshFeed}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-linear-to-r from-violet-600 to-blue-600"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}