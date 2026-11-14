import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationsContext";
import { POST_LIFETIME_HOURS, same, isVideo } from "./utils";

const PostsContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const usePosts = () => useContext(PostsContext);

// short text shown inside a notification
const snip = (p) => (p?.content || "").slice(0, 60) || null;

// Old posts used file_data; new posts use files[] (many photos). Support both.
export const mapRow = (row) => ({
  ...row,
  files: Array.isArray(row.files) && row.files.length
    ? row.files
    : row.file_data ? [{ data: row.file_data, type: row.file_type, name: row.file_name }] : [],
  likes: row.likes || [],
  views: row.views || [],
  comment_count: row.comment_count || 0,
  repost_of: row.repost_of || null,
});

export function PostsProvider({ children }) {
  const { currentUser } = useAuth();
  const { notify } = useNotifications();
  const uid = currentUser?.id;

  const [allPosts, setAllPosts] = useState([]);
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
  const [profileUserId, setProfileUserId] = useState(null);       // user shown in the 80% sheet

  // ticks every 30s so timers update and expired posts disappear
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);

  const posts = useMemo(
    () => allPosts.filter((p) => new Date(p.expires_at).getTime() > now),
    [allPosts, now]
  );

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("id, surname, other_name, username, is_online, last_seen, avatar")
      .eq("status", "accepted");
    const map = {};
    (data || []).forEach((u) => { map[u.id] = u; });
    setUsers((prev) => ({ ...prev, ...map }));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("pantweets").select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (err) {
      console.error("Failed to load PanTweets:", err);
      setError("Could not load posts. Check your connection and try again.");
      return;
    }
    setError("");
    setAllPosts((data || []).map(mapRow));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadUsers();
    loadPosts();
    const channel = supabase
      .channel("pantweets-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pantweets" }, (p) =>
        setAllPosts((prev) => (prev.some((x) => same(x.id, p.new.id)) ? prev : [mapRow(p.new), ...prev])))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pantweets" }, (p) =>
        setAllPosts((prev) => prev.map((x) => (same(x.id, p.new.id) ? mapRow(p.new) : x))))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pantweets" }, (p) =>
        setAllPosts((prev) => prev.filter((x) => !same(x.id, p.old.id))))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, loadUsers, loadPosts]);

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
      // videos are too large for localStorage, so only photos/text are kept in the saved copy
      const snap = {
        ...post,
        file_data: null,
        files: post.files.filter((f) => !isVideo(f)),
        video_dropped: post.files.some(isVideo),
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
    notify(uid, "post_deleted", { preview: snip(gone) });
    return true;
  };

  const createPost = async ({ type, content, files = [], repost_of = null }) => {
    const { data, error: err } = await supabase.from("pantweets").insert([{
      user_id: currentUser.id,
      username: currentUser.username,
      type,
      content: content?.trim() || null,
      files,
      file_data: null, file_type: null, file_name: null,
      likes: [], views: [],
      repost_of,
      expires_at: new Date(Date.now() + POST_LIFETIME_HOURS * 3600000).toISOString(),
    }]).select().single();
    if (err) { console.error("Failed to post:", err); return err; }
    if (data) setAllPosts((prev) => (prev.some((x) => same(x.id, data.id)) ? prev : [mapRow(data), ...prev]));
    if (repost_of) notify(repost_of.user_id, "share", { postId: repost_of.id, preview: snip(repost_of) });
    return null;
  };

  const makeRepostRef = (post) => post.repost_of || {
    id: post.id, user_id: post.user_id, username: post.username, content: post.content,
    image: post.files.find((f) => !isVideo(f)) || null,
    has_video: post.files.some(isVideo),
    created_at: post.created_at,
  };

  const repostCountOf = (id) => posts.filter((p) => p.repost_of && same(p.repost_of.id, id)).length;
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
  };
  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}