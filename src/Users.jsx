import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { Users, ChevronLeft, ChevronRight, Circle } from "lucide-react";

/**
 * UsersContainer — shows online/offline users that the current user follows (or is followed by).
 * Replaces email with username. Shows green dot for online, gray for offline.
 */
function UsersContainer({ isDarkMode = false, onSelectUser }) {
  const { currentUser } = useAuth();
  const [showPanel, setShowPanel] = useState(true);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [followedUsers, setFollowedUsers] = useState([]);

  const dark = isDarkMode;

  // Track presence via Supabase Realtime
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          newPresences.forEach((p) => next.add(p.id));
          return next;
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          leftPresences.forEach((p) => next.delete(p.id));
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ id: currentUser.id, username: currentUser.username });
        }
      });

    return () => { channel.untrack(); supabase.removeChannel(channel); };
  }, [currentUser]);

  // Load mutual followers (users you follow AND who follow you)
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      // Who current user follows
      const { data: following } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", currentUser.id);

      const followingIds = (following || []).map((r) => r.following_id);
      if (followingIds.length === 0) { setFollowedUsers([]); return; }

      // Get their user details
      const { data: users } = await supabase
        .from("users")
        .select("id, username, surname, other_name, avatar_url")
        .in("id", followingIds)
        .eq("status", "accepted");

      setFollowedUsers(users || []);
    };
    load();
  }, [currentUser]);

  const getInitial = (u) => u.username?.[0]?.toUpperCase() || "?";

  const textCls = dark ? "text-white" : "text-gray-900";
  const subCls = dark ? "text-gray-400" : "text-gray-500";
  const bgCls = dark ? "bg-[#1a1a1a]" : "bg-gray-50";

  return (
    <div className={`p-2 ${bgCls} rounded-2xl h-full overflow-hidden flex flex-col`}>
      {!showPanel ? (
        <button onClick={() => setShowPanel(true)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
          <ChevronRight size={18} className={subCls} />
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Users size={15} className="text-amber-400" />
              <span className={`font-bold text-xs ${textCls}`}>Following</span>
              <span className="text-xs bg-amber-400/10 text-amber-400 font-bold px-1.5 py-0.5 rounded-full">
                {followedUsers.length}
              </span>
            </div>
            <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
              <ChevronLeft size={15} className={subCls} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5">
            {followedUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <Users size={28} className={`${subCls} opacity-40`} />
                <p className={`text-xs ${subCls}`}>No one followed yet</p>
              </div>
            ) : (
              followedUsers.map((user) => {
                const isOnline = onlineIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => onSelectUser?.(user)}
                    className={`flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all ${dark ? "hover:bg-white/5" : "hover:bg-gray-100"}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-amber-400/20 flex items-center justify-center font-black text-amber-400 text-xs">
                        {user.avatar_url
                          ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          : getInitial(user)
                        }
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border ${dark ? "border-[#1a1a1a]" : "border-gray-50"} ${isOnline ? "bg-green-400" : "bg-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${textCls} truncate`}>@{user.username}</p>
                      <p className={`text-xs ${isOnline ? "text-green-400" : subCls}`}>{isOnline ? "Online" : "Offline"}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Online count */}
          <div className={`mt-2 pt-2 border-t ${dark ? "border-white/5" : "border-gray-200"} text-xs ${subCls} text-center`}>
            {onlineIds.size} online now
          </div>
        </>
      )}
    </div>
  );
}

export default UsersContainer;