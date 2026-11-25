import { useCallback, useEffect, useState } from "react";
import { Flag, Megaphone, Scale, Bot, Wallet, BadgeCheck, Star } from "lucide-react";
import { supabase } from "../supabaseClient";
import { USER_COLS } from "./authShared";
import { removeMedia, removeUserMedia } from "./storage";
import { money } from "./GrowthSheets";
import AdminFeature from "./AdminFeature";

export const EXTRA_TABS = [
  { key: "postreports", label: "Post reports", Icon: Flag },
  { key: "ads", label: "Ads", Icon: Megaphone },
  { key: "appeals", label: "Appeals", Icon: Scale },
  { key: "bots", label: "Bots", Icon: Bot },
  { key: "payouts", label: "Payouts", Icon: Wallet },
  { key: "badges", label: "Badges", Icon: BadgeCheck },
  { key: "feature", label: "Feature", Icon: Star },
];

const card = "bg-[#1a1a1a] border border-white/5 rounded-2xl p-4";
const input = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600";
const btn = (c) => `px-3 py-1.5 rounded-xl text-xs font-bold border ${c}`;
const GREEN = "bg-green-500/10 border-green-500/30 text-green-400";
const RED = "bg-red-500/10 border-red-500/30 text-red-400";
const GREY = "bg-white/5 border-white/10 text-gray-300";
const AMBER = "bg-amber-400/10 border-amber-400/30 text-amber-400";

const Empty = ({ text }) => <p className="text-center text-sm text-gray-500 py-12">{text}</p>;
const when = (d) => new Date(d).toLocaleString();

async function usersById(ids) {
  const list = [...new Set(ids.map(String))];
  if (!list.length) return {};
  const { data } = await supabase.from("users").select(USER_COLS).in("id", list);
  return Object.fromEntries((data || []).map((u) => [String(u.id), u]));
}
async function postsById(ids) {
  const list = [...new Set(ids.map(String))];
  if (!list.length) return {};
  const { data } = await supabase.from("pantweets").select("id, user_id, content, files, kind, mod_label, source_url").in("id", list);
  return Object.fromEntries((data || []).map((p) => [String(p.id), p]));
}

function PostPreview({ post }) {
  if (!post) return <p className="text-xs text-gray-500">Post no longer exists.</p>;
  const img = (post.files || []).find((f) => f?.url && f.type?.startsWith("image/"));
  return (
    <div className="flex gap-3">
      {img && <img src={img.url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
      <div className="min-w-0">
        <p className="text-sm text-white line-clamp-4 whitespace-pre-wrap">{post.content || "(no text)"}</p>
        {post.source_url && <p className="text-xs text-blue-400 truncate">{post.source_url}</p>}
        {post.mod_label && <p className="text-xs text-amber-400">Labelled: {post.mod_label}</p>}
      </div>
    </div>
  );
}

// ---------------- reported posts ----------------
function PostReports() {
  const [groups, setGroups] = useState([]);
  const [posts, setPosts] = useState({});
  const [users, setUsers] = useState({});
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("reports").select("*").not("post_id", "is", null)
      .or("status.is.null,status.neq.reviewed").order("created_at", { ascending: false });
    const map = {};
    (data || []).forEach((r) => { (map[r.post_id] ||= []).push(r); });
    const ids = Object.keys(map);
    const p = await postsById(ids);
    setPosts(p);
    setUsers(await usersById(Object.values(p).map((x) => x.user_id)));
    setGroups(ids.map((id) => ({ id, reports: map[id] })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    const f = form[id] || {};
    const { data, error } = await supabase.rpc("admin_moderate_post", {
      p_post: id, p_action: action, p_label: action === "label" ? (f.label || "disputed") : null, p_note: f.note || null,
    });
    if (error) return alert(error.message);
    if (action === "remove") removeMedia(data?.paths || []);
    load();
  };
  const set = (id, k, v) => setForm((p) => ({ ...p, [id]: { ...(p[id] || {}), [k]: v } }));

  if (loading) return <Empty text="Loading…" />;
  if (!groups.length) return <Empty text="No reported posts waiting for review" />;
  return (
    <div className="space-y-3">
      {groups.map(({ id, reports }) => {
        const post = posts[id];
        const author = post && users[String(post.user_id)];
        return (
          <div key={id} className={card}>
            <p className="text-xs text-gray-500 mb-2">{reports.length} report{reports.length > 1 ? "s" : ""}{author ? ` · by @${author.username}` : ""}</p>
            <PostPreview post={post} />
            <div className="mt-2 space-y-0.5">
              {reports.slice(0, 4).map((r) => (
                <p key={r.id} className="text-xs text-gray-400">• <b>{r.reason_code || "other"}</b>: {String(r.reason || "").replace(/^\[Post [^\]]*\]\s*/, "")}</p>
              ))}
            </div>
            <input value={form[id]?.note || ""} onChange={(e) => set(id, "note", e.target.value)} placeholder="Note shown to the author (reason)…" className={`${input} mt-3`} />
            <div className="flex flex-wrap gap-2 mt-2">
              <select value={form[id]?.label || "disputed"} onChange={(e) => set(id, "label", e.target.value)} className="bg-[#0d0d0d] border border-white/10 rounded-xl px-2 text-xs text-white">
                {["disputed", "misleading", "false", "sensitive"].map((l) => <option key={l}>{l}</option>)}
              </select>
              <button disabled={!post} onClick={() => act(id, "label")} className={btn(AMBER)}>Add label</button>
              <button disabled={!post} onClick={() => act(id, "remove")} className={btn(RED)}>Remove post</button>
              <button onClick={() => act(id, "dismiss")} className={btn(GREY)}>Dismiss</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- ads ----------------
function Ads() {
  const [rows, setRows] = useState([]);
  const [posts, setPosts] = useState({});
  const [users, setUsers] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false }).limit(100);
    setRows(data || []);
    setPosts(await postsById((data || []).map((r) => r.post_id)));
    setUsers(await usersById((data || []).map((r) => r.owner_id)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id, approve) => {
    const { error } = await supabase.rpc("admin_review_promotion", { p_id: String(id), p_approve: approve, p_note: notes[id] || null });
    if (error) return alert(error.message);
    load();
  };

  if (loading) return <Empty text="Loading…" />;
  if (!rows.length) return <Empty text="No ads yet" />;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className={card}>
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>@{users[String(r.owner_id)]?.username || r.owner_id} · {r.goal}{r.cta_url ? ` → ${r.cta_url}` : ""}</span>
            <span className="font-bold text-amber-400">{r.status}</span>
          </div>
          <PostPreview post={posts[String(r.post_id)]} />
          <p className="text-xs text-gray-500 mt-2">{when(r.created_at)} · {r.impressions} views · {r.clicks} clicks{r.ends_at ? ` · ends ${when(r.ends_at)}` : ""}</p>
          {r.status === "pending_review" && (
            <div className="mt-3 space-y-2">
              <input value={notes[r.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="Reason if rejecting…" className={input} />
              <div className="flex gap-2">
                <button onClick={() => review(r.id, true)} className={btn(GREEN)}>Approve</button>
                <button onClick={() => review(r.id, false)} className={btn(RED)}>Reject</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- appeals ----------------
function Appeals() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("appeals").select("*").order("created_at", { ascending: false }).limit(100);
    setRows(data || []);
    setUsers(await usersById((data || []).map((a) => a.user_id).filter(Boolean)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    const { error } = await supabase.rpc("admin_decide_appeal", { p_appeal: String(id), p_decision: decision, p_note: notes[id] || null });
    if (error) return alert(error.message);
    load();
  };

  if (loading) return <Empty text="Loading…" />;
  if (!rows.length) return <Empty text="No appeals" />;
  return (
    <div className="space-y-3">
      {rows.map((a) => (
        <div key={a.id} className={card}>
          <div className="flex justify-between text-xs text-gray-400">
            <span>@{a.username || users[String(a.user_id)]?.username || "user"} · {a.target_type}</span>
            <span className={a.status === "open" ? "font-bold text-amber-400" : ""}>{a.status}</span>
          </div>
          <p className="text-sm text-white mt-2 whitespace-pre-wrap">{a.message}</p>
          <p className="text-xs text-gray-500 mt-1">{when(a.created_at)}</p>
          {a.status === "open" ? (
            <div className="mt-3 space-y-2">
              <input value={notes[a.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [a.id]: e.target.value }))} placeholder="Note to the user…" className={input} />
              <div className="flex gap-2">
                <button onClick={() => decide(a.id, "overturned")} className={btn(GREEN)}>Overturn (restore)</button>
                <button onClick={() => decide(a.id, "upheld")} className={btn(RED)}>Uphold decision</button>
              </div>
            </div>
          ) : a.admin_note && <p className="text-xs text-gray-400 mt-1">Note: {a.admin_note}</p>}
        </div>
      ))}
    </div>
  );
}

// ---------------- bots ----------------
function Bots() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_suspicious_accounts");
    if (error) alert(error.message);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const suspend = async (u) => {
    const reason = window.prompt(`Suspend @${u.username}? Reason shown to the user:`, "Automated or spam-like behaviour");
    if (reason === null) return;
    const { error } = await supabase.rpc("admin_set_status", { p_user: String(u.user_id), p_status: "suspended", p_reason: reason });
    if (error) return alert(error.message);
    load();
  };
  const remove = async (u) => {
    if (!window.confirm(`Delete @${u.username} and all their data?`)) return;
    await removeUserMedia(u.user_id);
    const { error } = await supabase.rpc("delete_account", { p_user: String(u.user_id) });
    if (error) return alert(error.message);
    load();
  };

  if (loading) return <Empty text="Loading…" />;
  if (!rows.length) return <Empty text="No suspicious activity in the last 24 hours" />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Accounts scored by activity in the last 24 hours (posting volume, mass following with no followers, brand-new accounts that burst-post). Review before acting.</p>
      {rows.map((u) => (
        <div key={u.user_id} className={card}>
          <div className="flex justify-between">
            <p className="font-bold text-sm text-white">@{u.username}</p>
            <span className="text-xs font-black text-amber-400">score {u.score}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            age {u.age_hours}h · {u.posts_24h} posts · {u.comments_24h} comments · {u.follows_24h} follows · {u.followers} followers
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => suspend(u)} className={btn(AMBER)}>Suspend</button>
            <button onClick={() => remove(u)} className={btn(RED)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- payouts ----------------
function Payouts() {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("payout_requests").select("*").order("created_at", { ascending: false }).limit(100);
    setRows(data || []);
    setUsers(await usersById((data || []).map((r) => r.creator_id)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, paid) => {
    const { error } = await supabase.rpc("admin_mark_payout", { p_id: String(id), p_paid: paid, p_note: notes[id] || null });
    if (error) return alert(error.message);
    load();
  };

  if (loading) return <Empty text="Loading…" />;
  if (!rows.length) return <Empty text="No payout requests" />;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className={card}>
          <div className="flex justify-between">
            <p className="font-bold text-sm text-white">@{users[String(r.creator_id)]?.username || r.creator_id} · {money(r.amount_minor, r.currency)}</p>
            <span className={`text-xs font-bold ${r.status === "requested" ? "text-amber-400" : "text-gray-400"}`}>{r.status}</span>
          </div>
          <p className="text-xs text-gray-300 mt-1 whitespace-pre-wrap">Pay to: {r.method_note}</p>
          <p className="text-xs text-gray-500">{when(r.created_at)}</p>
          {r.status === "requested" && (
            <div className="mt-3 space-y-2">
              <input value={notes[r.id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="Reference / note…" className={input} />
              <div className="flex gap-2">
                <button onClick={() => decide(r.id, true)} className={btn(GREEN)}>Mark as paid</button>
                <button onClick={() => decide(r.id, false)} className={btn(RED)}>Decline</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------- badges: publisher / business / verified / creator program ----------------
function Badges() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const search = async () => {
    const term = q.trim().replace(/[%_]/g, "");
    if (!term) return;
    const { data } = await supabase.from("users").select(USER_COLS).ilike("username", `%${term}%`).limit(8);
    setFound(data || []);
  };
  const save = async (u) => {
    const { error } = await supabase.rpc("admin_set_badge", { p_user: String(u.id), p_type: u.account_type, p_verified: !!u.verified, p_monetized: !!u.monetized });
    alert(error ? error.message : "Saved ✓");
  };
  const edit = (id, patch) => setFound((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u)));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search a username…" className={input} />
        <button onClick={search} className={btn(AMBER)}>Search</button>
      </div>
      {found.map((u) => (
        <div key={u.id} className={card}>
          <p className="font-bold text-sm text-white">@{u.username} <span className="text-xs font-normal text-gray-500">{u.surname} {u.other_name}</span></p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-300">
            <select value={u.account_type} onChange={(e) => edit(u.id, { account_type: e.target.value })} className="bg-[#0d0d0d] border border-white/10 rounded-xl px-2 py-1">
              <option value="personal">Personal</option><option value="business">Business</option><option value="publisher">Publisher</option>
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!u.verified} onChange={(e) => edit(u.id, { verified: e.target.checked })} /> Verified</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!u.monetized} onChange={(e) => edit(u.id, { monetized: e.target.checked })} /> Creator program</label>
            <button onClick={() => save(u)} className={btn(GREEN)}>Save</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminExtras({ tab }) {
  return (
    <div>
      {tab === "postreports" && <PostReports />}
      {tab === "ads" && <Ads />}
      {tab === "appeals" && <Appeals />}
      {tab === "bots" && <Bots />}
      {tab === "payouts" && <Payouts />}
      {tab === "badges" && <Badges />}
      {tab === "feature" && <AdminFeature />}
    </div>
  );
}
