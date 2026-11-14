import { useEffect, useState } from "react";
import { Send, Eye, Heart, MessageCircle, Repeat } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet, Avatar } from "./ui";
import { PostBody, ActionBar, RepostRef } from "./PostCard";
import { displayName, fmt, timeAgo, same } from "./utils";
import UserSheet from "./UserSheet";
import { PostMenu, InteractionsSheet } from "./PostMenu";
import { ReportSheet } from "./Settings";

// Post opens in a sheet covering 90% of the screen, rest of the screen stays blurred
function PostSheet() {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { openedPost, closePost, posts, users, now, recordView, deletePost, addComment, repostCountOf, interactionsOf, openUserSheet } = usePosts();
  const post = posts.find((p) => same(p.id, openedPost.id)) || openedPost; // live copy if it still exists
  const expired = new Date(post.expires_at).getTime() <= now;

  const [comments, setComments] = useState([]);
  const [loadingC, setLoadingC] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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
    const { data, error } = await addComment(post, draft);
    setSending(false);
    if (error) return alert("Could not send your comment. Check your connection.");
    setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [data, ...prev]));
    setDraft("");
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
        <div className="space-y-3">
          {comments.map((c) => {
            const u = { ...(users[c.user_id] || {}), username: users[c.user_id]?.username || c.username };
            return (
              <div key={c.id} className="flex gap-2.5">
                <button onClick={() => openUserSheet(c.user_id)} className="shrink-0 self-start rounded-full">
                  <Avatar user={u} size={32} />
                </button>
                <div className={`flex-1 min-w-0 rounded-2xl px-3 py-2 ${t.chip.split(" ")[0]}`}>
                  <p className="text-xs">
                    <span className="font-bold">{displayName(u)}</span>{" "}
                    <span className={t.sub}>@{u.username} · {timeAgo(c.created_at, now)}</span>
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`shrink-0 border-t p-3 flex items-center gap-2 ${t.line}`}>
        {expired ? (
          <p className={`text-sm w-full text-center ${t.sub}`}>This post has expired. Comments are closed.</p>
        ) : (
          <>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Write a comment…"
              className={`flex-1 border rounded-full px-4 py-2.5 text-sm outline-none ${t.input}`}
            />
            <button onClick={send} disabled={!draft.trim() || sending} className={`p-2.5 rounded-full disabled:opacity-40 ${t.accent}`}>
              <Send size={16} />
            </button>
          </>
        )}
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
  const { openedPost, repostTarget, menuPost, interactionsPost, reportReq, setReportReq, profileUserId } = usePosts();
  return (
    <>
      {openedPost && <PostSheet />}
      {repostTarget && <RepostSheet />}
      {profileUserId != null && <UserSheet nav={nav} />}
      {interactionsPost && <InteractionsSheet />}
      {menuPost && <PostMenu />}
      {/* own stacking context so the report sheet always sits on top */}
      {reportReq && (
        <div className="relative z-[95]">
          <ReportSheet preset={reportReq.user} post={reportReq.post} onClose={() => setReportReq(null)} />
        </div>
      )}
    </>
  );
}