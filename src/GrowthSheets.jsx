import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useTheme } from "./theme";
import { Sheet } from "./ui";
import { fmt } from "./utils";

const TIP_CURRENCY = "USD"; // must be a currency your payment account can accept

export const money = (minor, cur = "USD") => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format((minor || 0) / 100); }
  catch { return `${((minor || 0) / 100).toFixed(2)} ${cur}`; }
};

// opens the payment page (the secret keys stay in the Edge Function)
async function startCheckout(body) {
  const { data, error } = await supabase.functions.invoke("checkout", { body });
  if (error || !data?.url) throw new Error(data?.error || "Could not start the payment. Please try again.");
  window.location.href = data.url;
}

const errText = (e) => e?.message || "Something went wrong. Please try again.";
const AD_RULES = [
  "No illegal, deceptive, or misleading offers or claims.",
  "No adult content, weapons, drugs, gambling or scams.",
  "No hate, harassment or content aimed at children that is unsuitable for them.",
  "Political, health and financial ads must follow the advertising rules where you and your audience are.",
  "Your ad is clearly labelled “Promoted” and is reviewed before it runs. Rejected ads are never charged.",
];

function Field({ t, label, children }) {
  return (
    <label className="block">
      <span className={`text-xs font-bold ${t.sub}`}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// =============== Business profile + my promotions ===============
const CATEGORIES = ["Retail", "Food & drink", "Fashion", "Beauty", "Tech", "Services", "Education", "Media", "Entertainment", "Other"];
const STATUS = {
  pending_review: ["In review", "text-amber-500"], approved_unpaid: ["Approved · pay to start", "text-blue-500"],
  active: ["Live", "text-green-500"], ended: ["Ended", "text-gray-400"], rejected: ["Rejected", "text-red-400"],
};

export function BusinessSheet({ onClose }) {
  const { t } = useTheme();
  const { currentUser, updateCurrentUser } = useAuth();
  const [tab, setTab] = useState("profile");
  const [bio, setBio] = useState(currentUser.bio || "");
  const [website, setWebsite] = useState(currentUser.website || "");
  const [category, setCategory] = useState(currentUser.category || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [promos, setPromos] = useState([]);
  const [pkgs, setPkgs] = useState({});
  const business = currentUser.account_type === "business";
  const locked = currentUser.account_type === "publisher";

  const loadPromos = async () => {
    const [{ data: p }, { data: k }] = await Promise.all([
      supabase.from("promotions").select("*").eq("owner_id", String(currentUser.id)).order("created_at", { ascending: false }),
      supabase.from("ad_packages").select("*"),
    ]);
    setPromos(p || []);
    setPkgs(Object.fromEntries((k || []).map((x) => [x.id, x])));
  };
  useEffect(() => { if (tab === "promos") loadPromos(); }, [tab]);

  const switchType = async (type) => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("set_account_type", { p_type: type });
    setBusy(false);
    if (error) return setMsg(errText(error));
    updateCurrentUser({ account_type: type });
  };

  const save = async () => {
    setBusy(true); setMsg("");
    const w = website.trim();
    if (w && !/^https?:\/\//i.test(w)) { setBusy(false); return setMsg("The website must start with https://"); }
    const patch = { bio: bio.trim() || null, website: w || null, category: category || null };
    const { error } = await supabase.from("users").update(patch).eq("id", currentUser.id);
    setBusy(false);
    if (error) return setMsg("Could not save. Check your connection.");
    updateCurrentUser(patch);
    setMsg("Saved ✓");
  };

  const pay = async (id) => {
    try { await startCheckout({ purpose: "promotion", promotion_id: id }); } catch (e) { setMsg(errText(e)); }
  };

  return (
    <Sheet title="Business" onClose={onClose}>
      <div className={`flex p-1 rounded-2xl mb-3 ${t.chip.split(" ")[0]}`}>
        {[["profile", "Profile"], ["promos", "Promotions"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${tab === k ? t.accent : t.sub}`}>{l}</button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-3">
          {!locked && (
            <div className={`rounded-2xl border p-3 ${t.card}`}>
              <p className="text-sm font-bold">{business ? "This is a business account" : "Turn on a business account"}</p>
              <p className={`text-xs mt-1 ${t.sub}`}>Business accounts get a Business label, a profile with category and website, and can promote posts.</p>
              <button onClick={() => switchType(business ? "personal" : "business")} disabled={busy} className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold ${business ? t.chip : t.accent}`}>
                {business ? "Switch back to personal" : "Switch to business"}
              </button>
            </div>
          )}
          <Field t={t} label="About your business or yourself">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`} />
          </Field>
          <Field t={t} label="Website (https://…)">
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
          </Field>
          <Field t={t} label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <button onClick={save} disabled={busy} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>Save</button>
          {msg && <p className={`text-xs text-center ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</p>}
        </div>
      )}

      {tab === "promos" && (
        <div className="space-y-2">
          <p className={`text-xs ${t.sub}`}>To promote a post, open its ⋮ menu and choose “Promote this post”.</p>
          {msg && <p className="text-xs text-red-400">{msg}</p>}
          {promos.length === 0 && <p className={`text-center text-sm py-10 ${t.sub}`}>No promotions yet.</p>}
          {promos.map((p) => {
            const [label, color] = STATUS[p.status] || [p.status, ""];
            const pkg = pkgs[p.package_id];
            return (
              <div key={p.id} className={`rounded-2xl border p-3 ${t.card}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${color}`}>{label}</span>
                  <span className={`text-xs ${t.sub}`}>{pkg ? `${pkg.name} · ${money(pkg.price_minor, pkg.currency)}` : ""}</span>
                </div>
                <p className={`text-xs mt-1 ${t.sub}`}>
                  {fmt(Number(p.impressions))} views · {fmt(Number(p.clicks))} clicks
                  {p.ends_at ? ` · ends ${new Date(p.ends_at).toLocaleDateString()}` : ""}
                </p>
                {p.review_note && <p className="text-xs mt-1 text-red-400">{p.review_note}</p>}
                {p.status === "approved_unpaid" && (
                  <button onClick={() => pay(p.id)} className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold ${t.accent}`}>
                    Pay {pkg ? money(pkg.price_minor, pkg.currency) : ""} and go live
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

// =============== Promote a post ===============
export function PromoteSheet({ post, onClose }) {
  const { t } = useTheme();
  const [pkgs, setPkgs] = useState([]);
  const [pkg, setPkg] = useState("");
  const [goal, setGoal] = useState("reach");
  const [label, setLabel] = useState("Learn more");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from("ad_packages").select("*").order("days").then(({ data }) => { setPkgs(data || []); if (data?.[0]) setPkg(data[0].id); });
  }, []);

  const submit = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("create_promotion", {
      p_post: String(post.id), p_package: pkg, p_goal: goal,
      p_cta_label: goal === "visit" ? label : null, p_cta_url: goal === "visit" ? url.trim() : null,
      p_email: email.trim(), p_accept: accept,
    });
    setBusy(false);
    if (error) return setErr(errText(error));
    setDone(true);
  };

  return (
    <Sheet title="Promote this post" onClose={onClose} full={false}>
      {done ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-green-500 font-bold">Submitted for review ✓</p>
          <p className={`text-sm ${t.sub}`}>We will notify you when it is approved. Then pay from Settings → Business → Promotions to go live.</p>
          <button onClick={onClose} className={`mt-2 px-6 py-2.5 rounded-xl text-sm font-bold ${t.accent}`}>Done</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field t={t} label="How long should it run?">
            <div className="grid grid-cols-3 gap-2">
              {pkgs.map((p) => (
                <button key={p.id} onClick={() => setPkg(p.id)} className={`rounded-xl border py-2 text-center ${pkg === p.id ? t.accent : t.card}`}>
                  <p className="text-sm font-bold">{p.name}</p><p className="text-xs opacity-80">{money(p.price_minor, p.currency)}</p>
                </button>
              ))}
            </div>
          </Field>
          <Field t={t} label="Goal">
            <div className="grid grid-cols-2 gap-2">
              {[["reach", "Reach more people"], ["visit", "Send people to a link"]].map(([k, l]) => (
                <button key={k} onClick={() => setGoal(k)} className={`rounded-xl border py-2 text-xs font-bold ${goal === k ? t.accent : t.card}`}>{l}</button>
              ))}
            </div>
          </Field>
          {goal === "visit" && (
            <>
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} placeholder="Button text" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-website.com" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
            </>
          )}
          <Field t={t} label="Contact email (for your payment receipt)">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
          </Field>
          <div className={`rounded-xl border p-3 text-xs space-y-1 ${t.line}`}>
            <p className="font-bold">Ad policy</p>
            {AD_RULES.map((r) => <p key={r} className={t.sub}>• {r}</p>)}
            <label className="flex items-start gap-2 pt-2 font-semibold">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5" />
              I have read and accept the ad policy.
            </label>
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button onClick={submit} disabled={busy || !pkg || !accept || !email.trim()} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          <p className={`text-xs text-center ${t.sub}`}>You only pay after your ad is approved.</p>
        </div>
      )}
    </Sheet>
  );
}

// =============== Tip a creator ===============
export function TipSheet({ target, onClose }) {
  const { t } = useTheme();
  const [amount, setAmount] = useState(200);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { user, post } = target;

  const pay = async () => {
    setBusy(true); setErr("");
    try {
      await startCheckout({ purpose: "tip", creator_id: user.id, post_id: post?.id ?? null, amount_minor: amount, currency: TIP_CURRENCY, email: email.trim() });
    } catch (e) { setErr(errText(e)); setBusy(false); }
  };

  return (
    <Sheet title={`Tip @${user.username}`} onClose={onClose} full={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[100, 200, 500, 1000].map((a) => (
            <button key={a} onClick={() => setAmount(a)} className={`rounded-xl border py-2.5 text-sm font-bold ${amount === a ? t.accent : t.card}`}>{money(a, TIP_CURRENCY)}</button>
          ))}
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email (for the receipt)" className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button onClick={pay} disabled={busy || !email.trim()} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>{busy ? "Opening payment…" : `Tip ${money(amount, TIP_CURRENCY)}`}</button>
        <p className={`text-xs text-center ${t.sub}`}>The creator receives 90%. 10% supports the platform.</p>
      </div>
    </Sheet>
  );
}

// =============== Creator earnings ===============
export function CreatorSheet({ onClose }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const [rows, setRows] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.rpc("my_earnings"),
      supabase.from("payout_requests").select("*").eq("creator_id", String(currentUser.id)).order("created_at", { ascending: false }),
    ]);
    setRows(e || []); setReqs(r || []);
  };
  useEffect(() => { if (currentUser.monetized) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("apply_creator", { p_note: note });
    setBusy(false);
    setMsg(error ? errText(error) : "Application sent ✓ We will review it and notify you.");
  };

  const cur = rows[0]?.currency || "USD";
  const requestPayout = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("request_payout", { p_currency: cur, p_amount: Math.round(Number(amount) * 100), p_method: method });
    setBusy(false);
    if (error) return setMsg(errText(error));
    setAmount(""); setMethod(""); setMsg("Payout requested ✓"); load();
  };

  return (
    <Sheet title="Creator earnings" onClose={onClose}>
      {!currentUser.monetized ? (
        <div className="space-y-3">
          <p className="text-sm">Join the creator program to receive tips from your audience.</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Tell us about your content (optional)…" className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`} />
          <button onClick={apply} disabled={busy} className={`w-full py-3 rounded-xl font-bold text-sm ${t.accent}`}>Apply to the creator program</button>
          {msg && <p className="text-xs text-center">{msg}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.length === 0 && <p className={`text-sm ${t.sub}`}>No earnings yet. Fans can tip you from the ⋮ menu on your posts.</p>}
          {rows.map((r) => (
            <div key={r.currency} className={`rounded-2xl border p-4 ${t.card}`}>
              <p className={`text-xs ${t.sub}`}>Available balance</p>
              <p className="text-2xl font-black">{money(Number(r.balance), r.currency)}</p>
              <p className={`text-xs mt-1 ${t.sub}`}>Earned {money(Number(r.earned), r.currency)} · Paid out {money(Number(r.paid_out), r.currency)}</p>
            </div>
          ))}
          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="font-black text-sm">Request a payout</p>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Amount in ${cur} (minimum 20)`} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${t.input}`} />
              <textarea value={method} onChange={(e) => setMethod(e.target.value)} rows={2} placeholder="Where should we send it? (bank details, or mobile money number)" className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`} />
              <button onClick={requestPayout} disabled={busy || !amount || !method} className={`w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${t.accent}`}>Request payout</button>
              {msg && <p className={`text-xs text-center ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</p>}
            </div>
          )}
          {reqs.length > 0 && (
            <div className="space-y-1">
              <p className="font-black text-sm">Payout requests</p>
              {reqs.map((r) => (
                <div key={r.id} className={`flex justify-between rounded-xl border px-3 py-2 text-xs ${t.card}`}>
                  <span>{money(r.amount_minor, r.currency)} · {new Date(r.created_at).toLocaleDateString()}</span>
                  <span className="font-bold">{r.status}</span>
                </div>
              ))}
            </div>
          )}
          <p className={`text-xs ${t.sub}`}>Payouts are reviewed and sent manually. Tips are paid out minus a 10% platform fee.</p>
        </div>
      )}
    </Sheet>
  );
}

// =============== Moderation history and appeals ===============
const ACTION_TEXT = { label: "Post labelled", remove: "Post removed", suspend: "Account suspended", warn: "Warning" };

export function AppealsSheet({ onClose }) {
  const { t } = useTheme();
  const [log, setLog] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [open, setOpen] = useState(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.rpc("my_moderation"),
      supabase.from("appeals").select("*").order("created_at", { ascending: false }),
    ]);
    setLog(l || []); setAppeals(a || []);
  };
  useEffect(() => { load(); }, []);

  const send = async (entry) => {
    setBusy(true); setMsg("");
    const type = entry.action === "suspend" ? "account" : entry.action === "remove" ? "post" : "label";
    const { error } = await supabase.rpc("submit_appeal", { p_target_type: type, p_target_id: entry.post_id, p_message: text.trim() });
    setBusy(false);
    if (error) return setMsg(errText(error));
    setOpen(null); setText(""); setMsg("Appeal sent ✓"); load();
  };

  return (
    <Sheet title="Moderation & appeals" onClose={onClose}>
      {msg && <p className={`text-xs mb-2 ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</p>}
      {log.length === 0 && <p className={`text-center text-sm py-10 ${t.sub}`}>Nothing here. No action has been taken on your account or posts.</p>}
      <div className="space-y-2">
        {log.map((e) => (
          <div key={e.id} className={`rounded-2xl border p-3 ${t.card}`}>
            <p className="text-sm font-bold">{ACTION_TEXT[e.action] || e.action}</p>
            {e.snapshot?.content && <p className={`text-xs mt-1 line-clamp-3 ${t.sub}`}>“{e.snapshot.content}”</p>}
            {e.reason && <p className="text-xs mt-1">Reason: {e.reason}</p>}
            <p className={`text-[11px] mt-1 ${t.sub}`}>{new Date(e.created_at).toLocaleString()}</p>
            {open === e.id ? (
              <div className="mt-2 space-y-2">
                <textarea value={text} onChange={(e2) => setText(e2.target.value)} rows={3} placeholder="Explain why this decision should change (at least 5 characters)…" className={`w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none ${t.input}`} />
                <button onClick={() => send(e)} disabled={busy || text.trim().length < 5} className={`w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 ${t.accent}`}>Send appeal</button>
              </div>
            ) : (
              <button onClick={() => { setOpen(e.id); setText(""); }} className={`mt-2 px-4 py-1.5 rounded-xl text-xs font-bold ${t.chip}`}>Appeal</button>
            )}
          </div>
        ))}
      </div>
      {appeals.length > 0 && (
        <>
          <p className="font-black text-sm mt-5 mb-2">My appeals</p>
          {appeals.map((a) => (
            <div key={a.id} className={`rounded-xl border px-3 py-2 mb-1.5 text-xs ${t.card}`}>
              <div className="flex justify-between"><span className="font-bold">{a.target_type}</span><span>{a.status}</span></div>
              {a.admin_note && <p className={t.sub}>{a.admin_note}</p>}
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
