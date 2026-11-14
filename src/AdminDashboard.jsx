import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  Shield, Users, Bell, Trash2, CheckCircle, XCircle,
  LogOut, Flag, Eye, EyeOff, MessageSquare, RefreshCw, ArrowLeft
} from "lucide-react";

const ADMIN_USERNAME = "Alkali Jesse";
const ADMIN_PASSWORD = "Jessewizz123";

export default function AdminDashboard({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [loginForm, setLoginForm] = useState({ name: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [tab, setTab] = useState("pending");
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectMsg, setRejectMsg] = useState({});
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  const loadAll = async () => {
    setLoading(true);
    const [
      { data: pending },
      { data: all },
      { data: reps },
      { data: notifs },
    ] = await Promise.all([
      supabase.from("users").select("*").eq("status", "pending").order("created_at", { ascending: false }),
      supabase.from("users").select("*").order("created_at", { ascending: false }),
      supabase.from("reports").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }),
    ]);
    setPendingUsers(pending || []);
    setAllUsers(all || []);
    setReports(reps || []);
    setNotifications(notifs || []);
    setLoading(false);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (loginForm.name === ADMIN_USERNAME && loginForm.password === ADMIN_PASSWORD) {
      setAuthed(true); setLoginError("");
    } else {
      setLoginError("Invalid admin credentials.");
    }
  };

  // ── User actions ────────────────────────────────────────────────────────────

  const acceptUser = async (user) => {
    await supabase.from("users").update({ status: "accepted" }).eq("id", user.id);
    loadAll();
  };

  const rejectUser = async (user) => {
    const msg = rejectMsg[user.id] || "";
    await supabase.from("users").update({ status: "rejected" }).eq("id", user.id);
    if (msg) {
      await supabase.from("admin_notifications").insert([{
        type: "rejection_reason",
        ref_id: user.id,
        message: `Rejection message to @${user.username}: ${msg}`,
      }]);
    }
    setRejectMsg((p) => { const n = { ...p }; delete n[user.id]; return n; });
    loadAll();
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm("Permanently delete this user and all their data?")) return;
    await supabase.from("pantweets").delete().eq("user_id", userId);
    await supabase.from("followers").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    await supabase.from("reports").delete().eq("reporter_id", userId);
    if (username) await supabase.from("reports").delete().eq("reported_username", username);
    await supabase.from("users").delete().eq("id", userId);
    loadAll();
  };

  const saveUserEdit = async () => {
    await supabase.from("users").update({
      surname: editForm.surname,
      other_name: editForm.other_name,
      username: editForm.username,
      phone: editForm.phone,
      status: editForm.status,
    }).eq("id", editUser.id);
    setEditUser(null);
    loadAll();
  };

  // ── Notifications ───────────────────────────────────────────────────────────

  const markNotifRead = async (id) => {
    await supabase.from("admin_notifications").update({ read: true }).eq("id", id);
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Login screen ─────────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen w-full bg-[#0d0d0d] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-4">
              <Shield size={28} className="text-amber-400" />
            </div>
            <h1 className="text-white font-black text-2xl">Admin Panel</h1>
            <p className="text-gray-500 text-sm">Restricted access only</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <input
                type="text"
                placeholder="Admin name"
                value={loginForm.name}
                onChange={(e) => setLoginForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-600"
              />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-600"
              />
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="text-gray-500">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button type="submit" className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-black font-black rounded-xl transition-all">
              Sign In as Admin
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 text-sm font-bold transition-all"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  const tabs = [
    { key: "pending", label: "Pending Users", count: pendingUsers.length, icon: <Bell size={14} /> },
    { key: "all", label: "All Users", count: allUsers.length, icon: <Users size={14} /> },
    { key: "reports", label: "Reports", count: reports.length, icon: <Flag size={14} /> },
    { key: "notifications", label: "Inbox", count: unreadCount, icon: <MessageSquare size={14} /> },
  ];

  return (
    <div className="min-h-screen w-full bg-[#0d0d0d] text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0d0d0d]/90 backdrop-blur">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/5 transition-all text-gray-400 hover:text-white">
            <ArrowLeft size={16} />
          </button>
        )}
        <Shield size={18} className="text-amber-400" />
        <span className="font-black text-lg">Pan<span className="text-amber-400">dora</span> Admin</span>
        <div className="flex-1" />
        <button onClick={loadAll} className="p-2 rounded-xl hover:bg-white/5 transition-all text-gray-400">
          <RefreshCw size={15} />
        </button>
        <button onClick={() => setAuthed(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-gray-400 hover:bg-white/5 text-sm transition-all">
          <LogOut size={14} /> Logout
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                tab === t.key ? "bg-amber-400 text-black" : "bg-white/5 text-gray-400 hover:bg-white/10"
              }`}
            >
              {t.icon} {t.label}
              {t.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${tab === t.key ? "bg-black/20 text-black" : "bg-amber-400/20 text-amber-400"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>}

        {/* PENDING USERS */}
        {tab === "pending" && !loading && (
          <div className="space-y-3">
            {pendingUsers.length === 0 && <EmptyState icon={<Bell size={32} />} text="No pending registrations" />}
            {pendingUsers.map((user) => (
              <div key={user.id} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
                <UserInfo user={user} />
                <div className="mt-3 space-y-2">
                  <input
                    value={rejectMsg[user.id] || ""}
                    onChange={(e) => setRejectMsg((p) => ({ ...p, [user.id]: e.target.value }))}
                    placeholder="Rejection reason (optional)…"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => acceptUser(user)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-bold transition-all">
                      <CheckCircle size={14} /> Accept
                    </button>
                    <button onClick={() => rejectUser(user)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-bold transition-all">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ALL USERS */}
        {tab === "all" && !loading && (
          <div className="space-y-3">
            {allUsers.length === 0 && <EmptyState icon={<Users size={32} />} text="No users registered" />}
            {allUsers.map((user) => (
              <div key={user.id} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <UserInfo user={user} showStatus />
                  <div className="flex gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => { setEditUser(user); setEditForm({ surname: user.surname, other_name: user.other_name, username: user.username, phone: user.phone || "", status: user.status }); }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.username)}
                      className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && !loading && (
          <div className="space-y-3">
            {reports.length === 0 && <EmptyState icon={<Flag size={32} />} text="No reports filed" />}
            {reports.map((r) => (
              <div key={r.id} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-4">
                <div className="flex items-start gap-2 mb-2">
                  <Flag size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Report against <span className="text-amber-400">@{r.reported_username}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                    <p className="text-xs text-gray-600 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${r.status === "reviewed" ? "bg-green-500/10 text-green-400" : "bg-amber-400/10 text-amber-400"}`}>
                    {r.status}
                  </span>
                  {allUsers.some((u) => u.username === r.reported_username) ? (
                    <button
                      onClick={() => deleteUser(allUsers.find((u) => u.username === r.reported_username).id, r.reported_username)}
                      className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Delete account
                    </button>
                  ) : (
                    <span className="text-xs text-gray-600">Account already deleted</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && !loading && (
          <div className="space-y-3">
            {notifications.length === 0 && <EmptyState icon={<MessageSquare size={32} />} text="No notifications" />}
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => markNotifRead(n.id)}
                className={`bg-[#1a1a1a] border rounded-2xl p-4 cursor-pointer transition-all ${n.read ? "border-white/5 opacity-60" : "border-amber-400/30"}`}
              >
                <p className="text-sm text-white">{n.message}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                {!n.read && <span className="text-xs text-amber-400 font-bold">● New</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditUser(null)}>
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black text-white mb-4">Edit @{editUser.username}</h3>
            <div className="space-y-3">
              {[["surname", "Surname"], ["other_name", "Other Name"], ["username", "Username"], ["phone", "Phone"]].map(([field, label]) => (
                <input
                  key={field}
                  value={editForm[field] || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder={label}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white placeholder-gray-600"
                />
              ))}
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none text-white"
              >
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Cancel</button>
              <button onClick={saveUserEdit} className="flex-1 py-2 rounded-xl bg-amber-400 text-black text-sm font-black">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserInfo({ user, showStatus }) {
  const statusColors = { accepted: "text-green-400", pending: "text-amber-400", rejected: "text-red-400" };
  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="font-bold text-sm text-white">@{user.username} <span className="text-gray-500 font-normal text-xs">— {user.surname} {user.other_name}</span></p>
        <p className="text-xs text-gray-500">{user.phone || "No phone"} · {new Date(user.created_at).toLocaleDateString()}</p>
        {showStatus && <p className={`text-xs font-bold ${statusColors[user.status] || "text-gray-400"}`}>{user.status}</p>}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <div className="flex justify-center mb-3 opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}