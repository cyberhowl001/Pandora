import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import {
  Users, MessageCircle, UserPlus, UserMinus,
  Search, LogOut, Moon, Sun, Flag, Rss, Plus
} from "lucide-react";

export default function Dashboard({ onGoToChat, onGoToGroupChat, onGoToDirect, onGoToPantweet, onCreateGroup, newPantweetCount, isDarkMode, setIsDarkMode }) {
  const { currentUser, logout } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [tab, setTab] = useState("all");
  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    loadUsers();
    loadFollowing();
    loadFollowers();
  }, [currentUser]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, surname, other_name, username, avatar_url, is_online, last_seen")
      .eq("status", "accepted")
      .neq("id", currentUser.id);
    setAllUsers(data || []);
  };

  const loadFollowing = async () => {
    const { data } = await supabase
      .from("followers")
      .select("following_id")
      .eq("follower_id", currentUser.id);
    setFollowing((data || []).map((r) => r.following_id));
  };

  const loadFollowers = async () => {
    const { data } = await supabase
      .from("followers")
      .select("follower_id")
      .eq("following_id", currentUser.id);
    setFollowers((data || []).map((r) => r.follower_id));
  };

  const toggleFollow = async (targetId) => {
    if (following.includes(targetId)) {
      await supabase.from("followers").delete()
        .eq("follower_id", currentUser.id).eq("following_id", targetId);
      setFollowing((p) => p.filter((id) => id !== targetId));
    } else {
      await supabase.from("followers").insert([{ follower_id: currentUser.id, following_id: targetId }]);
      setFollowing((p) => [...p, targetId]);
    }
  };

  const sendReport = async () => {
    if (!reportReason.trim()) return;
    await supabase.from("reports").insert([{
      reporter_id: currentUser.id,
      reported_username: reportModal.username,
      reason: reportReason,
    }]);
    await supabase.from("admin_notifications").insert([{
      type: "report",
      message: `@${currentUser.username} reported @${reportModal.username}: ${reportReason}`,
    }]);
    setReportSent(true);
    setTimeout(() => { setReportModal(null); setReportReason(""); setReportSent(false); }, 2000);
  };

  const isFollowingEachOther = (userId) => following.includes(userId) && followers.includes(userId);

  const filtered = allUsers.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      `${u.surname} ${u.other_name}`.toLowerCase().includes(search.toLowerCase());
    if (tab === "online") return matchSearch && u.is_online;
    if (tab === "following") return matchSearch && following.includes(u.id);
    return matchSearch;
  });

  const dark = isDarkMode;
  const bg = dark ? "bg-[#0d0d0d]" : "bg-[#f5f0ea]";
  const card = dark ? "bg-[#1a1a1a] border-white/5" : "bg-white border-gray-200";
  const text = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const inputCls = dark
    ? "bg-white/5 border-white/10 text-white placeholder-gray-600 focus:border-amber-400/50"
    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400";

  return (
    <div className={`min-h-screen w-full ${bg} ${text} flex flex-col`}>
      {/* Top bar */}
      <header className={`sticky top-0 z-30 flex items-center gap-2 px-4 py-3 border-b ${dark ? "bg-[#0d0d0d]/90 border-white/5" : "bg-white/90 border-gray-200"} backdrop-blur`}>
        <img src="panda.png" alt="" className="w-7" />
        <span className="font-black text-lg">Pan<span className="text-amber-400">dora</span></span>
        <div className="flex-1" />

        {/* PanTweet */}
        <button
          onClick={onGoToPantweet}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 text-sm font-bold transition-all"
        >
          <Rss size={14} />
          <span className="hidden sm:inline">PanTweet</span>
          {newPantweetCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
          )}
        </button>

        {/* Group Chat */}
        <button
          onClick={onGoToGroupChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all ${dark ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-gray-100 hover:bg-gray-200 border-gray-200"}`}
        >
          <Users size={14} />
          <span className="hidden sm:inline">Groups</span>
        </button>

        {/* ✅ Create Group button — Dashboard only */}
        <button
          onClick={onCreateGroup}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-sm font-bold transition-all"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Create Group</span>
        </button>

        <button
          onClick={() => setIsDarkMode((p) => !p)}
          className={`p-2 rounded-xl ${dark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"} transition-all`}
        >
          {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-gray-500" />}
        </button>

        <button onClick={logout} className="p-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-all">
          <LogOut size={16} />
        </button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-5xl mx-auto w-full">
        {/* Left: Profile card */}
        <aside className="lg:w-64 shrink-0 space-y-3">
          <div className={`rounded-2xl p-4 border ${card}`}>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center text-2xl font-black text-amber-400 mb-2">
                {currentUser?.avatar_url
                  ? <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (currentUser?.username?.[0] || "?").toUpperCase()}
              </div>
              <p className="font-black text-base">@{currentUser?.username}</p>
              <p className={`text-xs ${sub}`}>{currentUser?.surname} {currentUser?.other_name}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <div><p className="font-bold">{following.length}</p><p className={`text-xs ${sub}`}>Following</p></div>
                <div><p className="font-bold">{followers.length}</p><p className={`text-xs ${sub}`}>Followers</p></div>
              </div>
            </div>
          </div>

          {/* ✅ Create Group — sidebar shortcut */}
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-black font-bold text-sm transition-all"
          >
            <Plus size={16} /> Create Group
          </button>

          {/* Open Group Chat */}
          <button
            onClick={onGoToGroupChat}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-all ${dark ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-white hover:bg-gray-50 border-gray-200"}`}
          >
            <Users size={16} className="text-amber-400" /> My Groups
          </button>

          {/* PanTweet Feed */}
          <button
            onClick={onGoToPantweet}
            className={`relative w-full flex items-center justify-center gap-2 py-3 rounded-2xl border font-bold text-sm transition-all ${dark ? "bg-white/5 hover:bg-white/10 border-white/10" : "bg-white hover:bg-gray-50 border-gray-200"}`}
          >
            <Rss size={16} className="text-amber-400" />
            PanTweet Feed
            {newPantweetCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-yellow-400 text-black text-xs rounded-full font-black">
                {newPantweetCount}
              </span>
            )}
          </button>
        </aside>

        {/* Right: User list */}
        <main className="flex-1 space-y-3">
          <div className={`rounded-2xl p-3 border ${card}`}>
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 mb-3 ${inputCls}`}>
              <Search size={14} className="text-amber-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by username or name…"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex gap-2">
              {[["all", "All Users"], ["online", "Online"], ["following", "Following"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    tab === key
                      ? "bg-amber-400 text-black"
                      : `${dark ? "bg-white/5 text-gray-400 hover:bg-white/10" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className={`text-center py-12 ${sub} text-sm`}>
                <Users size={36} className="mx-auto mb-2 opacity-30" />
                No users found
              </div>
            )}
            {filtered.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isFollowing={following.includes(user.id)}
                isMutual={isFollowingEachOther(user.id)}
                onFollow={() => toggleFollow(user.id)}
                onChat={() => onGoToDirect?.(user)}
                onReport={() => { setReportModal(user); setReportReason(""); }}
                dark={dark}
                card={card}
                sub={sub}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-5 border ${card} ${text}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Flag size={18} className="text-red-400" />
              <h3 className="font-black">Report @{reportModal.username}</h3>
            </div>
            {reportSent ? (
              <p className="text-green-400 text-sm text-center py-4">Report sent to admin ✓</p>
            ) : (
              <>
                <textarea
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Why are you reporting this account?"
                  rows={4}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setReportModal(null)} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${dark ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-gray-200 text-gray-500 hover:bg-gray-50"} transition-all`}>
                    Cancel
                  </button>
                  <button onClick={sendReport} disabled={!reportReason.trim()} className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50">
                    Send Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserCard({ user, isFollowing, isMutual, onFollow, onChat, onReport, dark, card, sub }) {
  const text = dark ? "text-white" : "text-gray-900";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border ${card} transition-all`}>
      <div className="relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400">
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            : user.username[0].toUpperCase()}
        </div>
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${dark ? "border-[#1a1a1a]" : "border-white"} ${user.is_online ? "bg-green-400" : "bg-gray-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${text} truncate`}>@{user.username}</p>
        <p className={`text-xs ${sub} truncate`}>{user.surname} {user.other_name}</p>
        {user.is_online && <p className="text-xs text-green-400 font-medium">● Online</p>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {isMutual && (
          <button onClick={onChat} className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black text-xs font-bold transition-all flex items-center gap-1">
            <MessageCircle size={12} /> Chat
          </button>
        )}
        <button
          onClick={onFollow}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
            isFollowing
              ? "bg-white/10 hover:bg-red-400/20 hover:text-red-400 text-gray-400"
              : "bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30"
          }`}
        >
          {isFollowing ? <><UserMinus size={12} /> Unfollow</> : <><UserPlus size={12} /> Follow</>}
        </button>
        <button onClick={onReport} className="p-1.5 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
          <Flag size={12} />
        </button>
      </div>
    </div>
  );
}