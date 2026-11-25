import { useState } from "react";
import { Search, Heart, Eye, Repeat, Bookmark, Activity, RotateCcw, ArrowLeft } from "lucide-react";
import { supabase } from "../supabaseClient";
import { USER_COLS } from "./authShared";

const card = "bg-[#1a1a1a] border border-white/5 rounded-2xl p-4";
const input = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600";
const num = "w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none text-white text-center";
const nameOf = (u) => `${u.surname || ""} ${u.other_name || ""}`.trim() || u.username;
const POST_COLS = "id, user_id, type, kind, content, files, likes, views, comment_count, repost_count, boost_likes, boost_views, boost_reposts, boost_saves, created_at, expires_at";

// "Interactions" = views + likes + comments + reposts. This button spreads a number over views, likes and reshares.
const spreadInteractions = (n) => {
  const likes = Math.round(n * 0.3), reposts = Math.round(n * 0.1);
  return { likes, reposts, views: n - likes - reposts, saves: 0 };
};

function PostRow({ post, onChanged }) {
  const [f, setF] = useState({ likes: "", views: "", reposts: "", saves: "", interactions: "" });
  const [busy, setBusy] = useState(false);
  const real = {
    likes: (post.likes || []).length, views: (post.views || []).length,
    reposts: post.repost_count || 0, comments: post.comment_count || 0,
  };
  const boost = { likes: post.boost_likes || 0, views: post.boost_views || 0, reposts: post.boost_reposts || 0, saves: post.boost_saves || 0 };
  const img = (post.files || []).find((x) => x?.url && x.type?.startsWith("image/"));
  const expired = new Date(post.expires_at).getTime() <= Date.now();
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const apply = async () => {
    const extra = f.interactions ? spreadInteractions(Math.max(0, parseInt(f.interactions, 10) || 0)) : { likes: 0, views: 0, reposts: 0, saves: 0 };
    const d = {
      p_likes: (parseInt(f.likes, 10) || 0) + extra.likes,
      p_views: (parseInt(f.views, 10) || 0) + extra.views,
      p_reposts: (parseInt(f.reposts, 10) || 0) + extra.reposts,
      p_saves: (parseInt(f.saves, 10) || 0) + extra.saves,
    };
    if (!d.p_likes && !d.p_views && !d.p_reposts && !d.p_saves) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_boost_post", { p_post: String(post.id), ...d });
    setBusy(false);
    if (error) return alert(error.message);
    setF({ likes: "", views: "", reposts: "", saves: "", interactions: "" });
    onChanged();
  };

  const clear = async () => {
    if (!window.confirm("Remove all boosts from this post?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_clear_boost", { p_post: String(post.id) });
    setBusy(false);
    if (error) return alert(error.message);
    onChanged();
  };

  const stat = (Icon, label, r, b) => (
    <div className="text-center">
      <Icon size={13} className="mx-auto text-gray-400" />
      <p className="text-sm font-black">{r + b}</p>
      <p className="text-[10px] text-gray-500">{label}{b > 0 ? ` (+${b})` : ""}</p>
    </div>
  );

  return (
    <div className={card}>
      <div className="flex gap-3">
        {img && <img src={img.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-white">{post.content || `(${post.type} post)`}</p>
          <p className="mt-1 text-[11px] text-gray-500">
            {new Date(post.created_at).toLocaleString()} · {expired ? "expired" : "live"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 rounded-xl bg-white/5 p-2">
        {stat(Heart, "Likes", real.likes, boost.likes)}
        {stat(Eye, "Views", real.views, boost.views)}
        {stat(Repeat, "Reshares", real.reposts, boost.reposts)}
        {stat(Bookmark, "Saves", 0, boost.saves)}
        {stat(Activity, "Interactions", real.likes + real.views + real.reposts + real.comments, boost.likes + boost.views + boost.reposts)}
      </div>

      <p className="mt-3 text-xs font-bold text-gray-400">Add (use a negative number to remove)</p>
      <div className="mt-1 grid grid-cols-5 gap-2">
        {[["likes", "Likes"], ["views", "Views"], ["reposts", "Reshares"], ["saves", "Saves"], ["interactions", "Interactions"]].map(([k, label]) => (
          <label key={k} className="block">
            <span className="mb-0.5 block text-center text-[10px] text-gray-500">{label}</span>
            <input type="number" inputMode="numeric" value={f[k]} onChange={set(k)} placeholder="0" className={num} />
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={apply} disabled={busy} className="flex-1 rounded-xl bg-amber-400 py-2 text-sm font-black text-black disabled:opacity-50">
          {busy ? "Saving…" : "Apply boost"}
        </button>
        <button onClick={clear} disabled={busy} className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 disabled:opacity-50">
          <RotateCcw size={13} /> Reset
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-600">Interactions are shared out as 60% views, 30% likes, 10% reshares. Each counter is capped at 5000 per post.</p>
    </div>
  );
}

export default function AdminEngagement() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const loadPosts = async (u) => {
    setLoading(true);
    const { data, error } = await supabase.from("pantweets").select(POST_COLS)
      .eq("user_id", u.id).order("created_at", { ascending: false }).limit(40);
    if (error) alert(error.message);
    setPosts(data || []);
    setLoading(false);
  };

  const open = (u) => { setUser(u); loadPosts(u); };

  if (user) {
    return (
      <div className="space-y-3">
        <button onClick={() => { setUser(null); setPosts([]); }} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white">
          <ArrowLeft size={14} /> Back to search
        </button>
        <p className="text-sm font-black text-white">{nameOf(user)} <span className="font-normal text-gray-500">@{user.username}</span></p>
        {loading && <p className="py-8 text-center text-sm text-gray-500">Loading…</p>}
        {!loading && posts.length === 0 && <p className="py-12 text-center text-sm text-gray-500">This user has no posts.</p>}
        {posts.map((p) => <PostRow key={p.id} post={p} onChanged={() => loadPosts(user)} />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a user by username or name…" className={input} />
        <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-sm font-black text-black"><Search size={14} /> Search</button>
      </form>
      {loading && <p className="py-8 text-center text-sm text-gray-500">Searching…</p>}
      {!loading && searched && results.length === 0 && <p className="py-12 text-center text-sm text-gray-500">No users found.</p>}
      {results.map((u) => (
        <button key={u.id} onClick={() => open(u)} className={`${card} flex w-full items-center gap-3 text-left`}>
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
