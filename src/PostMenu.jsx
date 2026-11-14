import { Activity, Flag, UserX, UserPlus, UserMinus, Heart, MessageCircle, Repeat, Eye, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useFollows } from "./FollowContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { displayName, fmt, same } from "./utils";

// Action menu opened by the three dots on a post
export function PostMenu() {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { menuPost: post, closePostMenu, users, setInteractionsPost, setReportReq } = usePosts();
  const { isFollowing, toggleFollow } = useFollows();

  const own = same(post.user_id, currentUser.id);
  const author = users[post.user_id] || { id: post.user_id, username: post.username };
  const following = isFollowing(post.user_id);
  const run = (fn) => () => { closePostMenu(); fn(); };

  const items = [
    [Activity, "View post interactions", run(() => setInteractionsPost(post))],
    ...(own ? [] : [
      [Flag, "Report post", run(() => setReportReq({ user: author, post })), true],
      [UserX, `Report @${author.username}`, run(() => setReportReq({ user: author })), true],
      following
        ? [UserMinus, `Unfollow @${author.username}`, run(() => toggleFollow(post.user_id))]
        : [UserPlus, `Follow @${author.username}`, run(() => toggleFollow(post.user_id))],
    ]),
  ];

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center" onClick={closePostMenu}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full  max-w-xl rounded-t-3xl border-t p-3 pb-6 space-y-1 ${t.page} ${t.text} ${t.line}`}
      >
        <div className="flex justify-center pb-1"><span className="w-60 h-1 rounded-full bg-gray-400/50" /></div>
        {items.map(([Icon, label, action, danger]) => (
          <button
            key={label}
            onClick={action}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold cursor-pointer text-sm ${danger ? "text-red-400" : ""}`}
          >
            <Icon size={18} className={danger ? "" : t.accentText} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Breakdown of one post's interactions + who liked it
export function InteractionsSheet() {
  const { t } = useTheme();
  const { interactionsPost, setInteractionsPost, posts, users, repostCountOf, interactionsOf } = usePosts();
  const post = posts.find((p) => same(p.id, interactionsPost.id)) || interactionsPost;
  const close = () => setInteractionsPost(null);

  const stats = [
    [Eye, "Views", post.views.length],
    [Heart, "Likes", post.likes.length],
    [MessageCircle, "Comments", post.comment_count || 0],
    [Repeat, "Reposts", repostCountOf(post.id)],
  ];

  return (
    <div className="fixed inset-0 z-75 flex items-end justify-center" onClick={close}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-xl max-h-[70dvh] overflow-y-auto rounded-t-3xl border-t p-5 ${t.page} ${t.text} ${t.line}`}
      >
        <div className="flex items-center mb-3">
          <h3 className="font-black flex-1">Post interactions</h3>
          <button onClick={close} className={`p-1 ${t.sub}`}><X size={18} /></button>
        </div>

        <div className={`rounded-2xl border p-3 ${t.accentSoft}`}>
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

        <h4 className="font-black text-sm mt-5 mb-2">Liked by</h4>
        {post.likes.length === 0 && <p className={`text-xs ${t.sub}`}>No likes yet.</p>}
        <div className="space-y-2">
          {post.likes.map((id) => {
            const u = users[id];
            if (!u) return null;
            return (
              <div key={id} className="flex items-center gap-3">
                <Avatar user={u} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{displayName(u)}</p>
                  <p className={`text-xs truncate ${t.sub}`}>@{u.username}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}