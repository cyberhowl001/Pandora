import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationsContext";
import { POST_LIFETIME_HOURS, same, isVideo } from "./utils";
import { uploadMedia, removeMedia } from "./storage";

const PostsContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const usePosts = () => useContext(PostsContext);

const FEED_PAGE = 10;   // posts the server returns per feed request
const USER_PAGE = 10;   // posts per request on a profile page
const IDS_CHUNK = 50;   // ids per "in" query

// short text shown inside a notification
const snip = (p) => (p?.content || "").slice(0, 60) || null;
const byNewest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// Old posts used file_data; new posts use files[] (many photos). Support both.
export const mapRow = (row) => ({
  ...row,
  files: Array.isArray(row.files) && row.files.length
    ? row.files
    : row.file_data ? [{ data: row.file_data, type: row.file_type, name: row.file_name }] : [],
  likes: row.likes || [],
  views: row.views || [],
  comment_count: row.comment_count || 0,
  repost_count: row.repost_count || 0,
  repost_of: row.repost_of || null,
});

// remember the newest created_at that was loaded into the feed
const bump = (ref, iso) => {
  if (iso && (!ref.current || new Date(iso) > new Date(ref.current))) ref.current = iso;
};

export function PostsProvider({ children }) {
  const { currentUser } = useAuth();
  const { notify } = useNotifications();
  const uid = currentUser?.id;

  const [allPosts, setAllPosts] = useState([]);   // every post loaded so far (feed + profiles + opened ones)
  const [feedIds, setFeedIds] = useState(() => new Set()); // which of them belong to the feed
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [users, setUsers] = useState({});
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [bookmarks, setBookmarks] = useState([]);
  const [openedPost, setOpenedPost] = useState(null);
  const [repostTarget, setRepostTarget] = useState(null);
  const [feedbackFor, setFeedbackFor] = useState(null); // post id to ask "good recommendation?" about
  const [menuPost, setMenuPost] = useState(null);                 // post whose 3-dot menu is open
  const [interactionsPost, setInteractionsPost] = useState(null); // post whose interactions are shown
  const [reportReq, setReportReq] = useState(null);               // { user, post? } being reported
  const [topicTag, setTopicTag] = useState(null);             // hashtag page that is open
  const [promoTarget, setPromoTarget] = useState(null);       // post being promoted
  const [tipTarget, setTipTarget] = useState(null);           // { user, post } being tipped
  const [profileUserId, setProfileUserId] = useState(null);       // user shown in the 80% sheet

  const feedBusy = useRef(false);
  const cursorRef = useRef(null);  // created_at of the OLDEST feed post loaded
  const newestRef = useRef(null);  // created_at of the NEWEST feed post loaded
  const allRef = useRef([]);
  allRef.current = allPosts;

  // ticks every 30s so timers update and expired posts disappear
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const posts = useMemo(
    () => allPosts.filter((p) => new Date(p.expires_at).getTime() > now),
    [allPosts, now]
  );
  // only the posts the feed has loaded (profiles / opened posts are not mixed into the feed)
  const feedPosts = useMemo(() => posts.filter((p) => feedIds.has(String(p.id))), [posts, feedIds]);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, surname, other_name, username, is_online, last_seen, avatar, account_type, verified, monetized, bio, website, category")
      .eq("status", "accepted");
    const map = {};
    (data || []).forEach((u) => { map[u.id] = u; });
    setUsers((prev) => ({ ...prev, ...map }));
  }, []);

  // ---------- server-side pagination ----------
  // add rows to the loaded set (new rows are added, known rows are refreshed)
  const merge = useCallback((rows) => {
    if (!rows?.length) return;
    const mapped = rows.map(mapRow);
    setAllPosts((prev) => {
      const byId = new Map(prev.map((p) => [String(p.id), p]));
      mapped.forEach((p) => byId.set(String(p.id), p));
      return [...byId.values()].sort(byNewest);
    });
  }, []);

  const addToFeed = useCallback((rows) => {
    if (!rows?.length) return;
    setFeedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => next.add(String(r.id)));
      return next;
    });
    rows.forEach((r) => bump(newestRef, r.created_at));
  }, []);

  // One page of the feed. reset=true starts again from the newest post.
  // Older pages use a cursor (created_at of the oldest post we have), so they stay
  // correct and fast no matter how many posts exist.
  const loadFeed = useCallback(async (reset = false) => {
    if (feedBusy.current) return;
    feedBusy.current = true;
    let q = supabase.from("pantweets").select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(FEED_PAGE);
    if (!reset && cursorRef.current) q = q.lt("created_at", cursorRef.current);
    const { data, error: err } = await q;
    feedBusy.current = false;
    if (err) {
      console.error("Failed to load PanTweets:", err);
      setError("Could not load posts. Check your connection and try again.");
      return;
    }
    setError("");
    const rows = data || [];
    if (reset) { setFeedIds(new Set()); newestRef.current = null; cursorRef.current = null; }
    merge(rows);
    addToFeed(rows);
    if (rows.length) cursorRef.current = rows[rows.length - 1].created_at;
    setFeedHasMore(rows.length === FEED_PAGE);
  }, [merge, addToFeed]);

  // stable callbacks (the feed uses them as effect dependencies)
  const loadMoreFeed = useCallback(() => loadFeed(false), [loadFeed]);
  const refresh = useCallback(() => loadFeed(true), [loadFeed]);

  // posts that were created while the app was in the background / offline
  const catchUp = useCallback(async () => {
    if (!newestRef.current) return;
    const { data } = await supabase.from("pantweets").select("*")
      .gt("expires_at", new Date().toISOString())
      .gt("created_at", newestRef.current)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data?.length) { merge(data); addToFeed(data); }
  }, [merge, addToFeed]);

  // one profile page of someone's posts (merged into the loaded set)
  const loadUserPosts = useCallback(async (userId, before = null) => {
    let q = supabase.from("pantweets").select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(USER_PAGE);
    if (before) q = q.lt("created_at", before);
    const { data, error: err } = await q;
    if (err) { console.error("Failed to load user posts:", err); return { rows: [], more: false }; }
    merge(data);
    return { rows: data || [], more: (data || []).length === USER_PAGE };
  }, [merge]);

  // fetch specific posts by id (bookmarks, notifications)
  const ensurePosts = useCallback(async (ids) => {
    const list = [...new Set((ids || []).map(String))];
    for (let i = 0; i < list.length; i += IDS_CHUNK) {
      const { data } = await supabase.from("pantweets").select("*")
        .in("id", list.slice(i, i + IDS_CHUNK))
        .gt("expires_at", new Date().toISOString());
      if (data?.length) merge(data);
    }
  }, [merge]);

  const openPostById = useCallback(async (id) => {
    let p = allRef.current.find((x) => same(x.id, id));
    if (!p) {
      const { data } = await supabase.from("pantweets").select("*").eq("id", id)
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (data) { merge([data]); p = mapRow(data); }
    }
    if (p) setOpenedPost(p);
  }, [merge]);

  useEffect(() => {
    if (!uid) return;
    loadUsers();
    loadFeed(true);
    const channel = supabase
      .channel("pantweets-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pantweets" }, (p) => {
        merge([p.new]); addToFeed([p.new]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pantweets" }, (p) =>
        // only refresh posts we already have
        setAllPosts((prev) => prev.map((x) => (same(x.id, p.new.id) ? mapRow(p.new) : x))))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pantweets" }, (p) =>
        setAllPosts((prev) => prev.filter((x) => !same(x.id, p.old.id))))
      .subscribe();

    const onVisible = () => { if (!document.hidden) catchUp(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", catchUp);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", catchUp);
    };
  }, [uid, loadUsers, loadFeed, merge, addToFeed, catchUp]);

  // keep my own entry in the users map fresh (name / avatar edits show instantly)
  useEffect(() => {
    if (currentUser) setUsers((p) => ({ ...p, [currentUser.id]: { ...p[currentUser.id], ...currentUser } }));
  }, [currentUser]);

  // ---------- bookmarks (localStorage, per user) ----------
  const bmKey = uid ? `pandora_bookmarks_${uid}` : null;
  useEffect(() => {
    if (!bmKey) return setBookmarks([]);
    try { setBookmarks(JSON.parse(localStorage.getItem(bmKey) || "[]")); } catch { setBookmarks([]); }
  }, [bmKey]);

  const isBookmarked = (id) => bookmarks.some((b) => same(b.id, id));

  const toggleBookmark = (post) => {
    let next;
    const adding = !isBookmarked(post.id);
    if (!adding) {
      next = bookmarks.filter((b) => !same(b.id, post.id));
    } else {
      // uploaded media is just a URL, so videos can be kept too.
      // Only old base64 videos are dropped (too large for localStorage).
      const snap = {
        ...post,
        file_data: null,
        files: post.files.filter((f) => f.url || !isVideo(f)),
        video_dropped: post.files.some((f) => !f.url && isVideo(f)),
        saved_at: Date.now(),
      };
      next = [snap, ...bookmarks];
    }
    try {
      localStorage.setItem(bmKey, JSON.stringify(next));
      setBookmarks(next);
      if (adding) notify(post.user_id, "save", { postId: post.id, preview: snip(post) });
    } catch {
      alert("Your device storage for bookmarks is full. Remove some saved posts and try again.");
    }
  };

  // ---------- post actions ----------
  const toggleLike = async (post) => {
    const liked = post.likes.some((i) => same(i, uid));
    const likes = liked ? post.likes.filter((i) => !same(i, uid)) : [...post.likes, uid];
    setAllPosts((prev) => prev.map((p) => (same(p.id, post.id) ? { ...p, likes } : p)));
    const { error: err } = await supabase.from("pantweets").update({ likes }).eq("id", post.id);
    if (err) setAllPosts((prev) => prev.map((p) => (same(p.id, post.id) ? { ...p, likes: post.likes } : p)));
    else if (!liked) notify(post.user_id, "like", { postId: post.id, preview: snip(post) });
  };

  // counts each person once, when they open a post (not the owner)
  const recordView = async (post) => {
    if (!uid || same(post.user_id, uid)) return;
    const live = allPosts.find((p) => same(p.id, post.id));
    if (!live || live.views.some((v) => same(v, uid))) return;
    const views = [...live.views, uid];
    setAllPosts((prev) => prev.map((p) => (same(p.id, post.id) ? { ...p, views } : p)));
    const { error: err } = await supabase.from("pantweets").update({ views }).eq("id", post.id);
    if (err) console.error("View failed:", err);
  };

  const deletePost = async (id) => {
    if (!window.confirm("Delete this PanTweet?")) return false;
    const gone = allPosts.find((p) => same(p.id, id));
    const { error: err } = await supabase.from("pantweets").delete().eq("id", id);
    if (err) { alert("Could not delete the post."); return false; }
    setAllPosts((prev) => prev.filter((p) => !same(p.id, id)));
    removeMedia((gone?.files || []).map((f) => f.path)); // free the storage space
    notify(uid, "post_deleted", { preview: snip(gone) });
    return true;
  };

  const createPost = async ({ type, content, files = [], repost_of = null, kind = "post", source_url = null, poll = null }) => {
    // photos / video go to Supabase Storage; the post only keeps their URLs
    let uploaded;
    try {
      uploaded = await Promise.all(files.map((f) => uploadMedia(f, currentUser.id)));
    } catch (e) {
      console.error("Upload failed:", e);
      return e;
    }
    const { data, error: err } = await supabase.from("pantweets").insert([{
      user_id: currentUser.id,
      username: currentUser.username,
      type,
      content: content?.trim() || null,
      files: uploaded,
      file_data: null, file_type: null, file_name: null,
      likes: [], views: [],
      repost_of,
      kind, source_url, poll,
      expires_at: new Date(Date.now() + POST_LIFETIME_HOURS * 3600000).toISOString(),
    }]).select().single();
    if (err) { console.error("Failed to post:", err); return err; }
    if (data) { merge([data]); addToFeed([data]); }
    if (repost_of) notify(repost_of.user_id, "share", { postId: repost_of.id, preview: snip(repost_of) });
    return null;
  };

  const makeRepostRef = (post) => post.repost_of || {
    id: post.id, user_id: post.user_id, username: post.username, content: post.content,
    image: post.files.find((f) => !isVideo(f)) || null,
    has_video: post.files.some(isVideo),
    created_at: post.created_at,
  };

  // repost_count is kept by the database, so it is right even for posts not fully loaded
  const repostCountOf = (id) => posts.find((p) => same(p.id, id))?.repost_count || 0;
  const interactionsOf = (p) => p.views.length + p.likes.length + (p.comment_count || 0) + repostCountOf(p.id);

  const addComment = async (post, content) => {
    const res = await supabase.from("pantweet_comments").insert([{
      post_id: String(post.id), user_id: String(uid), username: currentUser.username, content: content.trim(),
    }]).select().single();
    if (!res.error) notify(post.user_id, "comment", { postId: post.id, preview: content.trim().slice(0, 60) });
    return res;
  };

  const value = {
    posts, users, error, now, bookmarks,
    // feed pagination
    feedPosts, feedHasMore,
    loadMoreFeed, refresh,
    loadUserPosts, ensurePosts, openPostById,
    isBookmarked, toggleBookmark, toggleLike, recordView, deletePost, createPost, addComment,
    makeRepostRef, repostCountOf, interactionsOf,
    openedPost, openPost: setOpenedPost,
    closePost: () => {
      // after reading someone else's post, the feed asks if it was a good recommendation
      if (openedPost && !same(openedPost.user_id, uid)) setFeedbackFor(openedPost.id);
      setOpenedPost(null);
    },
    feedbackFor, clearFeedback: () => setFeedbackFor(null),
    repostTarget, setRepostTarget,
    // 3-dot menu, post interactions, reports, and the 80% user sheet
    menuPost, openPostMenu: setMenuPost, closePostMenu: () => setMenuPost(null),
    interactionsPost, setInteractionsPost,
    reportReq, setReportReq,
    profileUserId, openUserSheet: setProfileUserId, closeUserSheet: () => setProfileUserId(null),
    ingest: merge,
    topicTag, openTopic: (tag) => { setOpenedPost(null); setTopicTag(String(tag).replace(/^#/, "")); }, closeTopic: () => setTopicTag(null),
    promoTarget, setPromoTarget, tipTarget, setTipTarget,
  };
  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
