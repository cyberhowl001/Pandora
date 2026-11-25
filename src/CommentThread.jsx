import { useMemo, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { displayName, fmt, timeAgo } from "./utils";

const MAX_INDENT = 4; // deeper replies stay at the same indent so the thread never gets squeezed

function Node({ c, depth, ctx }) {
  const { t, users, openUserSheet, kids, likeMap, selected, setSelected, folded, toggleFold, reply, onLike, expired, now } = ctx;
  const id = String(c.id);
  const u = { ...(users[c.user_id] || {}), username: users[c.user_id]?.username || c.username };
  const replies = kids.get(id) || [];
  const lk = likeMap[id] || { count: 0, mine: false };
  const open = selected === id;
  const isFolded = folded.has(id);
  const n = replies.length;
  const parts = [];
  if (lk.count > 0) parts.push(`${fmt(lk.count)} ${lk.count === 1 ? "like" : "likes"}`);
  if (n > 0) parts.push(isFolded ? `View ${fmt(n)} ${n === 1 ? "reply" : "replies"}` : `${fmt(n)} ${n === 1 ? "reply" : "replies"}`);

  return (
    <div>
      <div className="flex gap-2.5">
        <button onClick={() => openUserSheet(c.user_id)} className="shrink-0 self-start rounded-full">
          <Avatar user={u} size={depth ? 26 : 32} />
        </button>
        <div className="min-w-0 flex-1">
          <div
            onClick={() => setSelected(open ? null : id)}
            className={`cursor-pointer rounded-2xl px-3 py-2 ${t.chip.split(" ")[0]} ${open ? "ring-2 ring-violet-500/50" : ""}`}
          >
            <p className="text-xs">
              <span className="font-bold">{displayName(u)}</span>{" "}
              <span className={t.sub}>@{u.username} · {timeAgo(c.created_at, now)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{c.content}</p>
          </div>

          {open ? (
            <div className="mt-1.5 flex items-center gap-5 px-1">
              <button onClick={() => reply(c)} disabled={expired} className="flex items-center gap-1.5 text-xs font-bold text-violet-500 disabled:opacity-40">
                <MessageCircle size={16} /> {fmt(n)}
              </button>
              <button onClick={() => onLike(c)} className={`flex items-center gap-1.5 text-xs font-bold ${lk.mine ? "text-red-400" : "text-violet-500"}`}>
                <Heart size={16} fill={lk.mine ? "currentColor" : "none"} /> {fmt(lk.count)}
              </button>
              {n > 0 && (
                <button onClick={() => toggleFold(id)} className={`ml-auto text-xs font-semibold ${t.sub}`}>
                  {isFolded ? "Show replies" : "Hide replies"}
                </button>
              )}
            </div>
          ) : parts.length > 0 && (
            n > 0
              ? <button onClick={() => toggleFold(id)} className={`mt-1 px-1 text-[11px] font-semibold ${t.sub}`}>{parts.join(" · ")}</button>
              : <p className={`mt-1 px-1 text-[11px] font-semibold ${t.sub}`}>{parts.join(" · ")}</p>
          )}
        </div>
      </div>

      {n > 0 && !isFolded && (
        <div className={`mt-2 space-y-3 ${depth < MAX_INDENT ? "ml-4 border-l-2 border-violet-500/30 pl-3" : ""}`}>
          {replies.map((r) => <Node key={r.id} c={r} depth={depth + 1} ctx={ctx} />)}
        </div>
      )}
    </div>
  );
}

// Comments as a tree. Tap a comment to show its reply and like buttons. The vertical line on the left
// of a group of replies shows which comment they were made on (tap "Hide replies" to fold a group).
export default function CommentThread({ comments, likeMap, onLike, onReply, expired, now }) {
  const { t } = useTheme();
  const { users, openUserSheet } = usePosts();
  const [selected, setSelected] = useState(null);
  const [folded, setFolded] = useState(() => new Set());

  // top-level comments keep their order (newest first); replies read oldest first, like a conversation.
  // A reply whose parent is not available (e.g. hidden) is shown as a normal comment.
  const { roots, kids } = useMemo(() => {
    const ids = new Set(comments.map((c) => String(c.id)));
    const kids = new Map();
    const roots = [];
    comments.forEach((c) => {
      const p = c.parent_id ? String(c.parent_id) : null;
      if (p && ids.has(p)) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
      else roots.push(c);
    });
    kids.forEach((list) => list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    return { roots, kids };
  }, [comments]);

  const toggleFold = (id) => setFolded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const reply = (c) => { setFolded((s) => { const n = new Set(s); n.delete(String(c.id)); return n; }); onReply(c); };

  const ctx = { t, users, openUserSheet, kids, likeMap, selected, setSelected, folded, toggleFold, reply, onLike, expired, now };
  return <div className="space-y-4">{roots.map((c) => <Node key={c.id} c={c} depth={0} ctx={ctx} />)}</div>;
}
