import { useEffect, useRef, useState } from "react";
import { Send, Eye, Heart, MessageCircle, Repeat, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet } from "./ui";
import CommentThread from "./CommentThread";
import { PostBody, ActionBar, RepostRef } from "./PostCard";
import { fmt, same } from "./utils";
import UserSheet from "./UserSheet";
import { PostMenu, InteractionsSheet } from "./PostMenu";
import { ReportSheet } from "./Settings";
import TopicPage from "./TopicPage";
import { PromoteSheet, TipSheet } from "./GrowthSheets";

// Post opens in a sheet covering 90% of the screen, rest of the screen stays blurred
function PostSheet() {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { openedPost, closePost, posts, now, recordView, deletePost, addComment, repostCountOf, interactionsOf } = usePosts();
  const post = posts.find((p) => same(p.id, openedPost.id)) || openedPost; // live copy if it still exists
  const expired = new Date(post.expires_at).getTime() <= now;

  const [comments, setComments] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);   // the comment being answered (null = a normal comment)
  const [likeMap, setLikeMap] = useState({});     // { commentId: { count, mine } }
  const inputRef = useRef(null);

  useEffect(() => {
    recordView(post);
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("pantweet_comments").select("*")
        .eq("post_id", String(post.id))
        .order("created_at", { ascending: false })
        .limit(500);
      if (alive) { setComments(data || []); setLoadingC(false); }
    })();
    supabase.rpc("comment_likes_for", { p_post: String(post.id) }).then(({ data }) => {
      if (!alive || !data) return; // before comments.sql has been run this just stays empty
      const m = {};
      data.forEach((r) => { m[String(r.comment_id)] = { count: Number(r.likes), mine: !!r.mine }; });
      setLikeMap(m);
    });
    const channel = supabase
      .channel(`comments-${post.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "pantweet_comments", filter: `post_id=eq.${post.id}` },
        (p) => setComments((prev) => (prev.some((c) => c.id === p.new.id) ? prev : [p.new, ...prev])))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const send = async () => {
    if (!draft.trim() || sending || expired) return;
    setSending(true);
    const { data, error } = await addComment(post, draft, replyTo);
    setSending(false);
    if (error) {
      console.error("[comment] failed:", error);
      return alert(String(error.message || "").includes("rate_limited")
        ? "You are commenting too fast. Please wait a little."
        : `Could not send your comment. (${error.message || "unknown error"})`);
    }
    setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [data, ...prev]));
    setDraft("");
    setReplyTo(null);
  };

  const startReply = (c) => { setReplyTo(c); inputRef.current?.focus(); };

  // like / unlike a comment: the screen changes at once, and is put back if the server refuses
  const likeComment = async (c) => {
    const id = String(c.id);
    const before = likeMap[id] || { count: 0, mine: false };
    setLikeMap((m) => ({ ...m, [id]: { count: Math.max(0, before.count + (before.mine ? -1 : 1)), mine: !before.mine } }));
    const { error } = await supabase.rpc("toggle_comment_like", { p_comment: id });
    if (error) { console.error("[comment like] failed:", error); setLikeMap((m) => ({ ...m, [id]: before })); }
  };

  const onDelete = async () => { if (await deletePost(post.id)) closePost(); };
  const stats = [
    [Eye, "Views", post.views.length],
    [Heart, "Likes", post.likes.length],
    [MessageCircle, "Comments", Math.max(post.comment_count || 0, comments.length)],
    [Repeat, "Reposts", repostCountOf(post.id)],
  ];

  return (
    <Sheet title="PanTweet" onClose={closePost} scroll={false}>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <PostBody post={post} inSheet onDelete={onDelete} />
        <ActionBar post={post} />

        {/* interaction label */}
        <div className={`mt-3 rounded-2xl border p-3 ${t.accentSoft}`}>
          <p className="text-xs font-black mb-2">{fmt(interactionsOf(post))} interactions</p>
          <div className="grid grid-cols-4 gap-2">
            {stats.map(([Icon, label, n]) => (
              <div key={label} className="text-center">
                <Icon size={14} className="mx-auto mb-0.5" />
                <p className="font-black text-sm">{fmt(n)}</p>
                <p className="text-[10px] opacity-70">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <h4 className="font-black text-sm mt-5 mb-2">Comments</h4>
        {loadingC && <p className={`text-xs ${t.sub}`}>Loading…</p>}
        {!loadingC && comments.length === 0 && <p className={`text-xs ${t.sub}`}>No comments yet. Start the conversation.</p>}
        <CommentThread comments={comments} likeMap={likeMap} onLike={likeComment} onReply={startReply} expired={expired} now={now} />
      </div>

      <div className={`shrink-0 border-t ${t.line}`}>
        {replyTo && !expired && (
          <div className={`flex items-center gap-2 px-4 pt-2 text-xs ${t.sub}`}>
            <span className="min-w-0 flex-1 truncate">Replying to <b>@{replyTo.username}</b></span>
            <button onClick={() => setReplyTo(null)} className="p-1" title="Cancel reply"><X size={14} /></button>
          </div>
        )}
        <div className="flex items-center gap-2 p-3">
          {expired ? (
            <p className={`w-full text-center text-sm ${t.sub}`}>This post has expired. Comments are closed.</p>
          ) : (
            <>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={replyTo ? `Reply to @${replyTo.username}…` : "Write a comment…"}
                className={`flex-1 rounded-full border px-4 py-2.5 text-sm outline-none ${t.input}`}
              />
              <button onClick={send} disabled={!draft.trim() || sending} className={`rounded-full p-2.5 disabled:opacity-40 ${t.accent}`}>
                <Send size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}

// In-app share: re-post someone's post with a reference to the original user
function RepostSheet() {
  const { t } = useTheme();
  const { repostTarget: post, setRepostTarget, makeRepostRef, createPost } = usePosts();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = makeRepostRef(post);

  const submit = async () => {
    setBusy(true);
    const e = await createPost({ type: "text", content: caption, files: [], repost_of: ref });
    setBusy(false);
    if (e) return setErr("Could not repost. Try again.");
    setRepostTarget(null);
  };

  return (
    <Sheet title="Repost to your PanTweet" onClose={() => setRepostTarget(null)} full={false}>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Add your own words (optional)…"
        rows={3}
        className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3 ${t.input}`}
      />
      <RepostRef refPost={ref} />
      {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
      <button onClick={submit} disabled={busy} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>
        {busy ? "Reposting…" : "Repost (lasts 48h)"}
      </button>
    </Sheet>
  );
}

export function PostOverlays({ nav }) {
  const { openedPost, repostTarget, menuPost, interactionsPost, reportReq, setReportReq, profileUserId,
          topicTag, promoTarget, setPromoTarget, tipTarget, setTipTarget } = usePosts();
  return (
    <>
      {topicTag && <TopicPage />}
      {openedPost && <PostSheet />}
      {repostTarget && <RepostSheet />}
      {profileUserId != null && <UserSheet nav={nav} />}
      {interactionsPost && <InteractionsSheet />}
      {menuPost && <PostMenu />}
      {/* own stacking contexts so these sheets always sit on top */}
      {promoTarget && <div className="relative z-[95]"><PromoteSheet post={promoTarget} onClose={() => setPromoTarget(null)} /></div>}
      {tipTarget && <div className="relative z-[95]"><TipSheet target={tipTarget} onClose={() => setTipTarget(null)} /></div>}
      {reportReq && (
        <div className="relative z-[95]">
          <ReportSheet preset={reportReq.user} post={reportReq.post} onClose={() => setReportReq(null)} />
        </div>
      )}
    </>
  );
}
