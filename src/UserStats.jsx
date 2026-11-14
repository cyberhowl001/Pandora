import { useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat, Eye, Activity, CalendarDays, FileText } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useTheme } from "./theme";
import { fmt } from "./utils";

export const joinedOn = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—";

// Lifetime numbers for a user. They come from the `user_stats` table (kept by
// database triggers), so they stay even after the posts have expired.
// `refreshKey` lets the caller force a refetch (e.g. after follow / unfollow).
export function useUserStats(userId, refreshKey = 0) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (userId == null) return;
    let alive = true;
    setStats(null);
    (async () => {
      const [st, fr, fg, usr] = await Promise.all([
        supabase.from("user_stats").select("*").eq("user_id", String(userId)).maybeSingle(),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
      ]);
      if (!alive) return;
      const d = st.data || {};
      const likes = d.likes_received || 0;
      const comments = d.comments_received || 0;
      const reshares = d.reshares_received || 0;
      const views = d.views_received || 0;
      setStats({
        likes, comments, reshares, views,
        posts: d.posts_created || 0,
        interactions: likes + comments + reshares + views,
        followers: fr.count || 0,
        following: fg.count || 0,
        joined: usr.data?.created_at || null,
      });
    })();
    return () => { alive = false; };
  }, [userId, refreshKey]);

  return stats;
}

// Presentational block: joined date + lifetime totals
export function StatsView({ s }) {
  const { t } = useTheme();
  if (!s) return <p className={`text-center text-xs py-6 ${t.sub}`}>Loading…</p>;
  const cells = [
    [Heart, "Likes", s.likes],
    [MessageCircle, "Comments", s.comments],
    [Repeat, "Reshares", s.reshares],
    [Eye, "Views", s.views],
  ];
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-4 text-xs ${t.sub}`}>
        <span className="flex items-center gap-1.5"><CalendarDays size={14} /> Joined {joinedOn(s.joined)}</span>
        <span className="flex items-center gap-1.5"><FileText size={14} /> {fmt(s.posts)} PanTweets posted</span>
      </div>
      <div className={`rounded-2xl border p-3 ${t.accentSoft}`}>
        <p className="text-xs font-black mb-2 flex items-center gap-1.5">
          <Activity size={14} /> {fmt(s.interactions)} total interactions
        </p>
        <div className="grid grid-cols-4 gap-2">
          {cells.map(([Icon, label, n]) => (
            <div key={label} className="text-center">
              <Icon size={14} className="mx-auto mb-0.5" />
              <p className="font-black text-sm">{fmt(n)}</p>
              <p className="text-[10px] opacity-70">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <p className={`text-[11px] ${t.sub}`}>Lifetime totals. They stay even after posts expire.</p>
    </div>
  );
}

// Fetches and shows the stats for one user (used on Profile and UserView)
export function StatsPanel({ userId }) {
  const { t } = useTheme();
  const s = useUserStats(userId);
  return (
    <div className={`rounded-2xl border p-4 ${t.card}`}>
      <StatsView s={s} />
    </div>
  );
}