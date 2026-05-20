import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import {
  ArrowLeft, Users, Plus, Send, Trash2, UserMinus,
  MessageCircle, ChevronDown, ChevronUp, X, Check,
  Crown, UserPlus, Search, AlertCircle, Clock
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_KEY = (groupId) => `pandora_group_msgs_${groupId}`;

function loadLocal(groupId) {
  try { return JSON.parse(localStorage.getItem(LS_KEY(groupId)) || "[]"); }
  catch { return []; }
}

function saveLocal(groupId, msgs) {
  localStorage.setItem(LS_KEY(groupId), JSON.stringify(msgs));
}

function getInitial(u) {
  return u?.username?.[0]?.toUpperCase() || "?";
}

function Avatar({ user, size = 8 }) {
  const s = `w-${size} h-${size}`;
  return (
    <div className={`${s} rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-xs shrink-0`}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
        : getInitial(user)}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function GroupChat({ isDarkMode = false, onBack }) {
  const { currentUser } = useAuth();
  const dark = isDarkMode;

  // UI states
  const [view, setView] = useState("list"); // 'list' | 'chat' | 'create'
  const [activeGroup, setActiveGroup] = useState(null);

  // Group data
  const [myGroups, setMyGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Create group
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Chat
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState("");
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [memberMenu, setMemberMenu] = useState(null); // { user, x, y }
  const messagesEndRef = useRef(null);

  // Theme
  const bg = dark ? "bg-[#0d0d0d]" : "bg-[#f5f0ea]";
  const card = dark ? "bg-[#1a1a1a] border-white/5" : "bg-white border-gray-200";
  const text = dark ? "text-white" : "text-gray-900";
  const sub = dark ? "text-gray-400" : "text-gray-500";
  const input = dark
    ? "bg-white/5 border-white/10 text-white placeholder-gray-600"
    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400";

  // ── Load on mount ────────────────────────────────────────────────────────────

  useEffect(() => { if (currentUser) { loadMyGroups(); loadAllUsers(); } }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription when inside a chat
  useEffect(() => {
    if (view !== "chat" || !activeGroup) return;
    loadMessages(activeGroup.id);
    loadMembers(activeGroup.id);

    const channel = supabase
      .channel(`group_${activeGroup.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "group_messages",
        filter: `group_id=eq.${activeGroup.id}`
      }, (payload) => {
        const msg = payload.new;
        setMessages((prev) => {
          const updated = [...prev, msg];
          saveLocal(activeGroup.id, updated);
          return updated;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [view, activeGroup]);

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadMyGroups = async () => {
    // Groups where current user is a member
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", currentUser.id);

    const ids = (memberRows || []).map((r) => r.group_id);
    if (ids.length === 0) { setMyGroups([]); return; }

    const { data: groups } = await supabase
      .from("groups")
      .select("*")
      .in("id", ids)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    setMyGroups(groups || []);
  };

  const loadAllUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, username, surname, other_name, avatar_url")
      .eq("status", "accepted")
      .neq("id", currentUser.id);
    setAllUsers(data || []);
  };

  const loadMessages = (groupId) => {
    // Load locally stored first (instant), then also check if we want to persist to DB
    const local = loadLocal(groupId);
    setMessages(local);
  };

  const loadMembers = async (groupId) => {
    const { data } = await supabase
      .from("group_members")
      .select("user_id, role, joined_at")
      .eq("group_id", groupId);

    const ids = (data || []).map((r) => r.user_id);
    if (ids.length === 0) { setMembers([]); return; }

    const { data: users } = await supabase
      .from("users")
      .select("id, username, surname, other_name, avatar_url")
      .in("id", ids);

    const withRole = (users || []).map((u) => ({
      ...u,
      role: data.find((r) => r.user_id === u.id)?.role || "member",
    }));
    setMembers(withRole);
  };

  // ── Create Group ─────────────────────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!createName.trim()) { setCreateError("Group name is required."); return; }
    if (selectedMembers.length === 0) { setCreateError("Add at least one member."); return; }
    setCreating(true); setCreateError("");

    // Insert group (status = 'pending' — admin must approve)
    const { data: group, error } = await supabase
      .from("groups")
      .insert([{
        name: createName.trim(),
        description: createDesc.trim(),
        created_by: currentUser.id,
        status: "pending",
      }])
      .select()
      .single();

    if (error || !group) { setCreateError("Failed to create group. Try again."); setCreating(false); return; }

    // Add creator as admin
    const memberInserts = [
      { group_id: group.id, user_id: currentUser.id, role: "admin" },
      ...selectedMembers.map((uid) => ({ group_id: group.id, user_id: uid, role: "member" })),
    ];
    await supabase.from("group_members").insert(memberInserts);

    // Notify admin
    await supabase.from("admin_notifications").insert([{
      type: "group_approval",
      ref_id: group.id,
      message: `@${currentUser.username} created a new group "${group.name}" pending approval. ${selectedMembers.length + 1} member(s).`,
    }]);

    setCreating(false);
    setCreateName(""); setCreateDesc(""); setSelectedMembers([]);
    setView("list");
    loadMyGroups();
  };

  // ── Send Message ─────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeGroup) return;
    const msg = {
      id: `local_${Date.now()}`,
      group_id: activeGroup.id,
      user_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url || null,
      content: msgInput.trim(),
      created_at: new Date().toISOString(),
    };

    // Optimistic local update
    setMessages((prev) => {
      const updated = [...prev, msg];
      saveLocal(activeGroup.id, updated);
      return updated;
    });
    setMsgInput("");

    // Also persist to Supabase so all members see it
    await supabase.from("group_messages").insert([{
      group_id: activeGroup.id,
      user_id: currentUser.id,
      username: currentUser.username,
      avatar_url: currentUser.avatar_url || null,
      content: msg.content,
    }]);
  };

  const deleteAllMessages = () => {
    if (!activeGroup) return;
    if (!window.confirm("Delete all messages for you? (This only clears your local copy)")) return;
    localStorage.removeItem(LS_KEY(activeGroup.id));
    setMessages([]);
  };

  // ── Member Actions ───────────────────────────────────────────────────────────

  const isAdmin = activeGroup && members.find((m) => m.id === currentUser.id)?.role === "admin";

  const removeMember = async (userId) => {
    if (!activeGroup) return;
    await supabase.from("group_members")
      .delete()
      .eq("group_id", activeGroup.id)
      .eq("user_id", userId);
    setMemberMenu(null);
    loadMembers(activeGroup.id);
  };

  const leaveGroup = async () => {
    if (!activeGroup) return;
    if (!window.confirm("Leave this group?")) return;
    await supabase.from("group_members")
      .delete()
      .eq("group_id", activeGroup.id)
      .eq("user_id", currentUser.id);
    setView("list");
    setActiveGroup(null);
    loadMyGroups();
  };

  // ── Filtered users for create ────────────────────────────────────────────────

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ─── RENDER: List View ───────────────────────────────────────────────────────

  if (view === "list") return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col`}>
      <header className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b ${dark ? "bg-[#0d0d0d]/90 border-white/5" : "bg-white/90 border-gray-200"} backdrop-blur`}>
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 transition-all">
          <ArrowLeft size={16} />
        </button>
        <Users size={18} className="text-amber-400" />
        <span className="font-black text-lg">Group Chats</span>
        <div className="flex-1" />
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-bold text-sm transition-all"
        >
          <Plus size={14} /> Create Group
        </button>
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-3">
        {myGroups.length === 0 ? (
          <div className={`text-center py-20 ${sub}`}>
            <Users size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold mb-1">No group chats yet</p>
            <p className="text-sm">Create a group or wait to be added by someone</p>
          </div>
        ) : myGroups.map((g) => (
          <div
            key={g.id}
            onClick={() => { setActiveGroup(g); setView("chat"); }}
            className={`flex items-center gap-3 p-4 rounded-2xl border ${card} cursor-pointer transition-all hover:border-amber-400/30`}
          >
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-lg shrink-0">
              {g.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{g.name}</p>
              {g.description && <p className={`text-xs ${sub} truncate`}>{g.description}</p>}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full font-bold ${g.status === "approved" ? "bg-green-400/10 text-green-400" : "bg-amber-400/10 text-amber-400"}`}>
              {g.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── RENDER: Create View ─────────────────────────────────────────────────────

  if (view === "create") return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col`}>
      <header className={`sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b ${dark ? "bg-[#0d0d0d]/90 border-white/5" : "bg-white/90 border-gray-200"} backdrop-blur`}>
        <button onClick={() => setView("list")} className="p-2 rounded-xl hover:bg-white/10 transition-all">
          <ArrowLeft size={16} />
        </button>
        <span className="font-black text-lg">New Group</span>
      </header>

      <div className="flex-1 p-4 max-w-xl mx-auto w-full space-y-4">
        {/* Group info */}
        <div className={`rounded-2xl border ${card} p-4 space-y-3`}>
          <p className="font-bold text-sm">Group Details</p>
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Group name *"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${input}`}
          />
          <input
            value={createDesc}
            onChange={(e) => setCreateDesc(e.target.value)}
            placeholder="Description (optional)"
            className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${input}`}
          />
        </div>

        {/* Add members */}
        <div className={`rounded-2xl border ${card} p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">Add Members</p>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-bold`}>
              {selectedMembers.length} selected
            </span>
          </div>

          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 ${input}`}>
            <Search size={13} className="text-amber-400 shrink-0" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {filteredUsers.map((u) => {
              const sel = selectedMembers.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedMembers((p) => sel ? p.filter((id) => id !== u.id) : [...p, u.id])}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${sel ? "bg-amber-400/10 border border-amber-400/30" : `${dark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}`}
                >
                  <Avatar user={u} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">@{u.username}</p>
                    <p className={`text-xs ${sub} truncate`}>{u.surname} {u.other_name}</p>
                  </div>
                  {sel && <Check size={14} className="text-amber-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin approval notice */}
        <div className={`flex items-start gap-2.5 p-3 rounded-xl ${dark ? "bg-amber-400/5 border border-amber-400/20" : "bg-amber-50 border border-amber-200"}`}>
          <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className={`text-xs ${dark ? "text-amber-300" : "text-amber-700"}`}>
            Your group will be reviewed by an admin before it becomes active. You'll be able to chat once approved.
          </p>
        </div>

        {createError && <p className="text-red-400 text-sm">{createError}</p>}

        <button
          onClick={handleCreateGroup}
          disabled={creating}
          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-black font-black text-sm transition-all disabled:opacity-50"
        >
          {creating ? "Submitting…" : "Submit for Approval"}
        </button>
      </div>
    </div>
  );

  // ─── RENDER: Chat View ───────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 border-b ${dark ? "bg-[#0d0d0d]/90 border-white/5" : "bg-white/90 border-gray-200"} backdrop-blur`}>
        <button onClick={() => { setView("list"); setActiveGroup(null); setMessages([]); setMembers([]); }} className="p-2 rounded-xl hover:bg-white/10 transition-all">
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate">{activeGroup?.name}</p>
          {activeGroup?.description && <p className={`text-xs ${sub} truncate`}>{activeGroup.description}</p>}
        </div>

        {/* Members dropdown toggle */}
        <button
          onClick={() => setShowMembers((p) => !p)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${dark ? "bg-white/5 hover:bg-white/10" : "bg-gray-100 hover:bg-gray-200"}`}
        >
          <Users size={13} />
          <span>{members.length}</span>
          {showMembers ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Leave group */}
        <button onClick={leaveGroup} className="p-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-all" title="Leave group">
          <UserMinus size={15} />
        </button>
      </header>

      {/* Members Panel (dropdown) */}
      {showMembers && (
        <div className={`border-b ${dark ? "bg-[#111] border-white/5" : "bg-gray-50 border-gray-200"} px-4 py-3`}>
          <p className={`text-xs font-bold ${sub} mb-2`}>Members · {members.length}</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <div
                key={m.id}
                onClick={(e) => {
                  if (m.id === currentUser.id) return;
                  setMemberMenu(memberMenu?.user?.id === m.id ? null : { user: m });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all relative ${
                  m.id === currentUser.id
                    ? "bg-amber-400/10 text-amber-400 cursor-default"
                    : `${dark ? "bg-white/5 hover:bg-white/10" : "bg-white hover:bg-gray-100 border border-gray-200"}`
                }`}
              >
                <Avatar user={m} size={5} />
                <span>@{m.username}</span>
                {m.role === "admin" && <Crown size={10} className="text-amber-400" />}

                {/* Member action popup */}
                {memberMenu?.user?.id === m.id && (
                  <div className={`absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-xl ${dark ? "bg-[#1a1a1a] border-white/10" : "bg-white border-gray-200"} min-w-[160px] overflow-hidden`}>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeMember(m.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <UserMinus size={12} /> Remove Member
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMemberMenu(null); /* trigger DM */ }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold ${dark ? "text-gray-300 hover:bg-white/5" : "text-gray-700 hover:bg-gray-50"} transition-all`}
                    >
                      <MessageCircle size={12} /> Chat Privately
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMemberMenu(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold ${dark ? "text-gray-500 hover:bg-white/5" : "text-gray-400 hover:bg-gray-50"} transition-all`}
                    >
                      <X size={12} /> Close
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" onClick={() => setMemberMenu(null)}>
        {messages.length === 0 && (
          <div className={`text-center py-16 ${sub} text-sm`}>
            <MessageCircle size={36} className="mx-auto mb-3 opacity-20" />
            <p>No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.user_id === currentUser.id;
          return (
            <div key={msg.id || i} className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : ""}`}>
              {!isMine && (
                <div className="w-7 h-7 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-xs shrink-0 mt-1">
                  {msg.avatar_url
                    ? <img src={msg.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (msg.username?.[0]?.toUpperCase() || "?")}
                </div>
              )}
              <div className={`max-w-[70%] space-y-0.5 ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                {!isMine && (
                  <span className={`text-xs font-bold ${sub} px-1`}>@{msg.username}</span>
                )}
                <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                  isMine
                    ? "bg-amber-400 text-black rounded-tr-sm"
                    : `${dark ? "bg-white/10" : "bg-white border border-gray-200"} rounded-tl-sm`
                }`}>
                  {msg.content}
                </div>
                <span className={`text-xs ${sub} px-1`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className={`sticky bottom-0 border-t ${dark ? "bg-[#0d0d0d] border-white/5" : "bg-white border-gray-200"} px-3 py-3`}>
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          {/* Delete all messages */}
          <button
            onClick={deleteAllMessages}
            className="p-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
            title="Delete all messages"
          >
            <Trash2 size={15} />
          </button>

          <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2 ${input}`}>
            <input
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Type a message…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!msgInput.trim()}
            className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-black transition-all disabled:opacity-40 shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}