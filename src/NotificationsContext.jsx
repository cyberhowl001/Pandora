import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { displayName } from "./utils";

const Ctx = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(Ctx);

const LOCAL_MAX = 200;                                 // max notifications kept on the device
const SELF_TYPES = ["profile", "post_deleted"];        // sent to yourself
const DEDUPE = ["like", "save", "follow", "unfollow"]; // a repeat replaces the unread one

const localKey = (uid) => `pandora_notifications_${uid}`;
const readLocal = (uid) => {
  try { return JSON.parse(localStorage.getItem(localKey(uid)) || "[]"); } catch { return []; }
};
const writeLocal = (uid, list) => {
  try { localStorage.setItem(localKey(uid), JSON.stringify(list)); } catch { /* storage full */ }
};

export function NotificationsProvider({ children }) {
  const { currentUser } = useAuth();
  const uid = currentUser ? String(currentUser.id) : null;
  const [unread, setUnread] = useState([]); // in the database, not seen yet
  const [saved, setSaved] = useState([]);   // seen: kept on this device
  const [viewing, setViewing] = useState(false);

  // load saved copy + unread from the database + listen for new ones
  useEffect(() => {
    if (!uid) { setUnread([]); setSaved([]); return; }
    setSaved(readLocal(uid));
    let cancelled = false;
    supabase.from("notifications").select("*").eq("user_id", uid)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled && data) setUnread(data); });

    const channel = supabase
      .channel(`notifications-${uid}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (p) => setUnread((prev) => (prev.some((n) => n.id === p.new.id) ? prev : [p.new, ...prev])))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [uid]);

  // move viewed notifications to the device and delete them from the database
  const flush = useCallback(async (rows) => {
    if (!uid || !rows.length) return;
    const ids = rows.map((n) => n.id);
    setSaved((prev) => {
      const next = [...rows, ...prev.filter((s) => !ids.includes(s.id))].slice(0, LOCAL_MAX);
      writeLocal(uid, next);
      return next;
    });
    setUnread((prev) => prev.filter((n) => !ids.includes(n.id)));
    const { error } = await supabase.from("notifications").delete().in("id", ids);
    if (error) console.error("Could not clear notifications:", error);
  }, [uid]);

  // while the notifications page is open, everything that arrives counts as viewed
  useEffect(() => {
    if (viewing && unread.length) flush(unread);
  }, [viewing, unread, flush]);

  // send a notification to someone: notify(userId, "like", { postId, preview })
  const notify = useCallback(async (toId, type, { postId = null, preview = null } = {}) => {
    if (!currentUser || toId == null) return;
    const to = String(toId);
    const me = String(currentUser.id);
    if (!SELF_TYPES.includes(type) && to === me) return; // never notify yourself about your own actions
    try {
      if (DEDUPE.includes(type)) {
        let q = supabase.from("notifications").delete()
          .eq("user_id", to).eq("actor_id", me).eq("type", type);
        q = postId != null ? q.eq("post_id", String(postId)) : q.is("post_id", null);
        await q;
      }
      await supabase.from("notifications").insert([{
        user_id: to,
        actor_id: me,
        actor_name: displayName(currentUser) || currentUser.username,
        type,
        post_id: postId != null ? String(postId) : null,
        preview,
      }]);
    } catch (e) { console.error("Notification failed:", e); }
  }, [currentUser]);

  const removeOne = (id) =>
    setSaved((prev) => { const next = prev.filter((n) => n.id !== id); writeLocal(uid, next); return next; });

  // "delete all": clears the device copy and anything still unread
  const clearAll = async () => {
    setSaved([]);
    writeLocal(uid, []);
    const ids = unread.map((n) => n.id);
    setUnread([]);
    if (ids.length) await supabase.from("notifications").delete().in("id", ids);
  };

  return (
    <Ctx.Provider value={{ count: unread.length, saved, notify, setViewing, removeOne, clearAll }}>
      {children}
    </Ctx.Provider>
  );
}