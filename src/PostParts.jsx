import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Newspaper, ShieldAlert, Megaphone, ExternalLink } from "lucide-react";
import { supabase } from "../supabaseClient";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { logAd } from "./postQueries";

const stop = (e) => e.stopPropagation();
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

// verified tick + Business / Publisher chip next to a name
export function AuthorBadges({ user }) {
  if (!user) return null;
  return (
    <>
      {user.verified && <BadgeCheck size={14} className="inline text-blue-500 shrink-0 ml-0.5" title="Verified" />}
      {user.account_type === "publisher" && (
        <span className="ml-1 px-1.5 py-px rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-500">Publisher</span>
      )}
      {user.account_type === "business" && (
        <span className="ml-1 px-1.5 py-px rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">Business</span>
      )}
    </>
  );
}

// "News" posts must carry a source link. Verified publishers get a verified label, everyone else is marked unverified.
export function SourceLabel({ post, author }) {
  if (post.kind !== "news" || !post.source_url) return null;
  const official = author?.account_type === "publisher" && author?.verified;
  return (
    <a
      href={post.source_url} target="_blank" rel="noopener noreferrer nofollow" onClick={stop}
      className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
        official ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "border-amber-500/30 bg-amber-500/10 text-amber-600"
      }`}
    >
      <Newspaper size={14} className="shrink-0" />
      <span className="flex-1 truncate">
        {official ? "Verified publisher" : "Community news · not verified"} · {hostOf(post.source_url)}
      </span>
      <ExternalLink size={12} className="shrink-0" />
    </a>
  );
}

const LABELS = {
  disputed:   ["Disputed", "Moderators found this claim disputed."],
  misleading: ["Misleading", "Moderators found this post misleading."],
  false:      ["False information", "Moderators found this to be false."],
  sensitive:  ["Sensitive content", "This post may be sensitive."],
};

// shown on posts that moderators labelled
export function ModBanner({ post }) {
  if (!post.mod_label || !LABELS[post.mod_label]) return null;
  const [title, text] = LABELS[post.mod_label];
  const bad = post.mod_label === "false";
  return (
    <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${bad ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
      <p className="font-bold flex items-center gap-1.5"><ShieldAlert size={14} /> {title}</p>
      <p className="mt-0.5 opacity-90">{post.mod_note || text}</p>
    </div>
  );
}

// poll: results appear after you vote or when the poll closes
export function PollBlock({ post }) {
  const { t } = useTheme();
  const options = post.poll?.options || [];
  const closed = new Date(post.expires_at).getTime() <= Date.now();
  const [state, setState] = useState(null); // { counts, mine }

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("poll_state", { p_posts: [String(post.id)] });
    const counts = (post.poll?.options || []).map(() => 0);
    let mine = null;
    (data || []).forEach((r) => { counts[r.option_index] = Number(r.votes); if (r.mine) mine = r.option_index; });
    setState({ counts, mine });
  }, [post.id, post.poll]);

  useEffect(() => { if (post.kind === "poll") load(); }, [post.kind, load]);
  if (post.kind !== "poll" || !options.length) return null;

  const vote = async (e, i) => {
    stop(e);
    if (closed || !state || state.mine != null) return;
    setState((s) => ({ counts: s.counts.map((c, k) => (k === i ? c + 1 : c)), mine: i }));
    const { error } = await supabase.rpc("vote_poll", { p_post: String(post.id), p_option: i });
    if (error) alert("Could not register your vote.");
    load();
  };

  const total = state ? state.counts.reduce((a, b) => a + b, 0) : 0;
  const reveal = state && (state.mine != null || closed);

  return (
    <div className="mb-3 space-y-2" onClick={stop}>
      {options.map((o, i) => {
        const pct = total ? Math.round((state.counts[i] / total) * 100) : 0;
        return (
          <button
            key={i} onClick={(e) => vote(e, i)} disabled={!state || closed || state.mine != null}
            className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${t.line}`}
          >
            {reveal && <span className="absolute inset-y-0 left-0 bg-violet-500/20" style={{ width: `${pct}%` }} />}
            <span className="relative flex items-center justify-between gap-2">
              <span className="truncate">{o}{state?.mine === i ? " ✓" : ""}</span>
              {reveal && <span className="text-xs">{pct}%</span>}
            </span>
          </button>
        );
      })}
      <p className={`text-xs ${t.sub}`}>{state ? `${total} ${total === 1 ? "vote" : "votes"}` : "…"}{closed ? " · closed" : ""}</p>
    </div>
  );
}

// ---- promoted posts (ads) ----
export function PromoLabel() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-500">
      <Megaphone size={10} /> Promoted
    </span>
  );
}

export function PromoCTA({ promo, post }) {
  const { openUserSheet } = usePosts();
  if (!promo) return null;
  const visit = promo.goal === "visit" && promo.cta_url;
  const go = (e) => {
    stop(e);
    logAd(promo.promotion_id, "click");
    if (visit) window.open(promo.cta_url, "_blank", "noopener,noreferrer");
    else openUserSheet(post.user_id);
  };
  return (
    <button onClick={go} className="mb-3 w-full rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600">
      {visit ? (promo.cta_label || "Learn more") : "View profile"}
    </button>
  );
}
