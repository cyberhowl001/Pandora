import { useState } from "react";
import { LogOut, Trash2, Flag, Mail, ChevronRight, Search, Briefcase, Wallet, Scale } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Sheet, Avatar } from "./ui";
import { displayName, same } from "./utils";
import { PANDORA_HELP_EMAIL } from "./pandoraInfo";
import { BusinessSheet, CreatorSheet, AppealsSheet } from "./GrowthSheets";

const REASONS = [["spam", "Spam"], ["misinformation", "Misinformation"], ["harassment", "Harassment"], ["sexual", "Sexual content"], ["violence", "Violence"], ["illegal", "Illegal"], ["other", "Other"]];

// Report a user, or a post by that user.
// Pass `preset` (a user) to skip the picker, and `post` to report a specific post.
export function ReportSheet({ onClose, preset = null, post = null }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users } = usePosts();
  const [target, setTarget] = useState(preset);
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("other");
  const [sent, setSent] = useState(false);

  const list = Object.values(users).filter((u) => !same(u.id, currentUser.id) &&
    `${u.username} ${displayName(u)}`.toLowerCase().includes(q.toLowerCase()));

  const send = async () => {
    if (!reason.trim() || !target) return;
    const what = post ? `post ${post.id} by @${target.username}` : `@${target.username}`;
    await supabase.from("reports").insert([{
      reporter_id: currentUser.id,
      reported_username: target.username,
      reason: post ? `[Post ${post.id}] ${reason}` : reason,
      reason_code: code,
      post_id: post ? String(post.id) : null,
    }]);
    await supabase.from("admin_notifications").insert([{
      type: "report", message: `@${currentUser.username} reported ${what}: ${reason}`,
    }]);
    setSent(true);
    setTimeout(onClose, 1800);
  };

  return (
    <Sheet title={post ? "Report post" : target ? `Report @${target.username}` : "Report a user"} onClose={onClose} full={false}>
      {sent ? (
        <p className="text-green-500 text-sm text-center py-8">Report sent to admin ✓</p>
      ) : !target ? (
        <>
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 mb-3 ${t.input}`}>
            <Search size={14} className={t.accentText} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find the user…" className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="space-y-1 max-h-[50dvh] overflow-y-auto">
            {list.map((u) => (
              <button key={u.id} onClick={() => setTarget(u)} className={`w-full flex items-center gap-3 p-2 rounded-xl ${t.chip}`}>
                <Avatar user={u} size={34} />
                <span className="text-left"><span className="block text-sm font-bold">{displayName(u)}</span><span className={`text-xs ${t.sub}`}>@{u.username}</span></span>
              </button>
            ))}
            {list.length === 0 && <p className={`text-center text-xs py-6 ${t.sub}`}>No users found</p>}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {REASONS.map(([k, l]) => (
              <button key={k} onClick={() => setCode(k)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${code === k ? "bg-red-500 text-white" : t.chip}`}>{l}</button>
            ))}
          </div>
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder={post ? "Why are you reporting this post?" : "Why are you reporting this account?"}
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${t.input}`}
          />
          <button onClick={send} disabled={!reason.trim()} className="mt-3 w-full py-3 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
            Send Report
          </button>
        </>
      )}
    </Sheet>
  );
}

export function SettingsSheet({ onClose }) {
  const { t } = useTheme();
  const { currentUser, logout, deleteAccount } = useAuth();
  const [view, setView] = useState("menu"); // menu | delete | help | report
  const [confirmText, setConfirmText] = useState("");
  const [helpMsg, setHelpMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doDelete = async () => {
    setBusy(true);
    const { error } = await deleteAccount();
    setBusy(false);
    if (error) setErr(error);
  };

  const mailto = `mailto:${PANDORA_HELP_EMAIL}?subject=${encodeURIComponent(`Pandora help - @${currentUser.username}`)}&body=${encodeURIComponent(helpMsg)}`;
  const row = `w-full flex items-center gap-3 p-4 rounded-2xl border text-left font-bold text-sm ${t.card}`;

  if (view === "report") return <ReportSheet onClose={onClose} />;
  if (view === "business") return <BusinessSheet onClose={onClose} />;
  if (view === "creator") return <CreatorSheet onClose={onClose} />;
  if (view === "appeals") return <AppealsSheet onClose={onClose} />;

  return (
    <Sheet title={view === "delete" ? "Delete account" : view === "help" ? "Send help message" : "Settings"} onClose={onClose}>
      {view === "menu" && (
        <div className="space-y-2">
          <button className={row} onClick={() => setView("business")}><Briefcase size={18} className={t.accentText} /><span className="flex-1">Business &amp; promotions</span><ChevronRight size={16} /></button>
          <button className={row} onClick={() => setView("creator")}><Wallet size={18} className={t.accentText} /><span className="flex-1">Creator earnings</span><ChevronRight size={16} /></button>
          <button className={row} onClick={() => setView("appeals")}><Scale size={18} className={t.accentText} /><span className="flex-1">Moderation &amp; appeals</span><ChevronRight size={16} /></button>
          <button className={row} onClick={() => setView("report")}><Flag size={18} className={t.accentText} /><span className="flex-1">Report a user</span><ChevronRight size={16} /></button>
          <button className={row} onClick={() => setView("help")}><Mail size={18} className={t.accentText} /><span className="flex-1">Send help message</span><ChevronRight size={16} /></button>
          <button className={`${row} text-red-400`} onClick={async () => { onClose(); await logout(); }}><LogOut size={18} /><span className="flex-1">Log out</span></button>
          <button className={`${row} text-red-500`} onClick={() => setView("delete")}><Trash2 size={18} /><span className="flex-1">Delete account</span><ChevronRight size={16} /></button>
        </div>
      )}

      {view === "help" && (
        <>
          <p className={`text-xs mb-3 ${t.sub}`}>Your message opens in your email app, addressed to the Pandora team ({PANDORA_HELP_EMAIL}).</p>
          <textarea
            value={helpMsg} onChange={(e) => setHelpMsg(e.target.value)} rows={6}
            placeholder="Tell us what you need help with…"
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${t.input}`}
          />
          <a
            href={helpMsg.trim() ? mailto : undefined}
            className={`mt-3 block text-center w-full py-3 rounded-xl text-sm font-bold ${t.accent} ${helpMsg.trim() ? "" : "opacity-50 pointer-events-none"}`}
          >
            Send to Pandora
          </a>
        </>
      )}

      {view === "delete" && (
        <>
          <p className="text-sm mb-3">This permanently deletes your account, your PanTweets, your comments and your follows. <b>This cannot be undone.</b></p>
          <p className={`text-xs mb-2 ${t.sub}`}>Type DELETE to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${t.input}`} />
          {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setView("menu")} className={`flex-1 py-3 rounded-xl text-sm font-bold ${t.chip}`}>Cancel</button>
            <button onClick={doDelete} disabled={confirmText !== "DELETE" || busy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
