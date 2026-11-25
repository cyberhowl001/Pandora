import { useCallback, useEffect, useState } from "react";
import { Search, Star, StarOff, ArrowLeft, Heart, Eye, Repeat, MessageCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { USER_COLS } from "./authShared";

const card = "bg-[#1a1a1a] border border-white/5 rounded-2xl p-4";
const input = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600";
const nameOf = (u) => `${u.surname || ""} ${u.other_name || ""}`.trim() || u.username;
const POST_COLS = "id, user_id, type, kind, content, files, likes, views, comment_count, repost_count, created_at, expires_at, featured_until, mod_label";
const HOURS = [6, 12, 24, 48];

const isLive = (p) => new Date(p.expires_at).getTime() > Date.now();
const isFeatured = (p) => p.featured_until && new Date(p.featured_until).getTime() > Date.now();
const left = (iso) => {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function PostRow({ post, onChanged }) {
  const [busy, setBusy] = useState(false);
  const img = (post.files || []).find((x) => x?.url && x.type?.startsWith("image/"));
  const featured = isFeatured(post);
  const live = isLive(post);
  const falseLabel = post.mod_label === "false";

  const run = async (fn, args) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return alert(error.message);
    onChanged();
  };

  const stat = (Icon, n) => <span className="flex items-center gap-1"><Icon size={12} /> {n}</span>;

  return (
    <div className={card}>
      <div className="flex gap-3">
        {img && <img src={img.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-white">{post.content || `(${post.type} post)`}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
            {stat(Heart, (post.likes || []).length)}{stat(Eye, (post.views || []).length)}
            {stat(MessageCircle, post.comment_count || 0)}{stat(Repeat, post.repost_count || 0)}
            <span>· {live ? `${left(post.expires_at)} left` : "expired"}</span>
          </div>
        </div>
      </div>

      {featured && (
        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-xs font-bold text-violet-300">
          <Star size={13} fill="currentColor" /> Featured, {left(post.featured_until)} remaining
        </p>
      )}

      {falseLabel && <p className="mt-3 text-xs text-red-400">Labelled false by moderators, it cannot be featured.</p>}

      {live && !falseLabel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">{featured ? "Extend for" : "Feature for"}</span>
          {HOURS.map((h) => (
            <button key={h} disabled={busy} onClick={() => run("admin_feature_post", { p_post: String(post.id), p_hours: h })}
              className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-black disabled:opacity-50">{h}h</button>
          ))}
          {featured && (
            <button disabled={busy} onClick={() => run("admin_unfeature_post", { p_post: String(post.id) })}
              className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300 disabled:opacity-50">
              <StarOff size={13} /> Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminFeature() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [current, setCurrent] = useState([]); // everything featured right now
  const [loading, setLoading] = useState(false);

  const loadCurrent = useCallback(async () => {
    const { data } = await supabase.from("pantweets").select(POST_COLS)
      .gt("featured_until", new Date().toISOString()).order("featured_until", { ascending: false });
    setCurrent(data || []);
  }, []);
  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  const search = async (e) => {
    e?.preventDefault();
    const term = q.trim().replace(/[%,()]/g, "");
    if (!term) return;
    setLoading(true);
    const { data } = await supabase.from("users").select(USER_COLS)
      .or(`username.ilike.%${term}%,surname.ilike.%${term}%,other_name.ilike.%${term}%`)
      .eq("status", "accepted").limit(20);
    setResults(data || []);
    setSearched(true);
    setLoading(false);
  };

  const loadPosts = useCallback(async (u) => {
    setLoading(true);
    const { data, error } = await supabase.from("pantweets").select(POST_COLS)
      .eq("user_id", u.id).order("created_at", { ascending: false }).limit(40);
    if (error) alert(error.message);
    setPosts(data || []);
    setLoading(false);
  }, []);

  const changed = () => { loadCurrent(); if (user) loadPosts(user); };

  if (user) {
    return (
      <div className="space-y-3">
        <button onClick={() => { setUser(null); setPosts([]); }} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Back to search
        </button>
        <p className="text-sm font-black text-white">{nameOf(user)} <span className="font-normal text-gray-500">@{user.username}</span></p>
        {loading && <p className="py-8 text-center text-sm text-gray-500">Loading…</p>}
        {!loading && posts.length === 0 && <p className="py-12 text-center text-sm text-gray-500">This user has no posts.</p>}
        {posts.map((p) => <PostRow key={p.id} post={p} onChanged={changed} />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Featured posts are real posts shown to everyone in the feed with a "Featured" label. Their numbers are not changed. Up to 5 at a time.
      </p>

      {current.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Featured now ({current.length}/5)</p>
          {current.map((p) => <PostRow key={p.id} post={p} onChanged={changed} />)}
        </div>
      )}

      <form onSubmit={search} className="flex gap-2 pt-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a user by username or name…" className={input} />
        <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-sm font-black text-black"><Search size={14} /> Search</button>
      </form>
      {loading && <p className="py-8 text-center text-sm text-gray-500">Searching…</p>}
      {!loading && searched && results.length === 0 && <p className="py-12 text-center text-sm text-gray-500">No users found.</p>}
      {results.map((u) => (
        <button key={u.id} onClick={() => { setUser(u); loadPosts(u); }} className={`${card} flex w-full items-center gap-3 text-left`}>
          {u.avatar
            ? <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
            : <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 font-black text-black">{(u.username || "?")[0].toUpperCase()}</span>}
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-white">{nameOf(u)}</span>
            <span className="block truncate text-xs text-gray-500">@{u.username}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
