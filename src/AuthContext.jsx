import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);
const KEY = "pandora_user";

// Remove the password before the user object is kept in state or storage
const stripSecret = (user) => {
  if (!user) return user;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...safe } = user;
  return safe;
};

const saveSession = (user) => {
  try { localStorage.setItem(KEY, JSON.stringify(stripSecret(user))); } catch { /* storage blocked */ }
};

const clearSession = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start: bring back the last account that was logged in on this device
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(KEY)); } catch { /* corrupted: ignore */ }

      if (!cached?.id) {
        setLoading(false);
        return;
      }

      // Show the saved account straight away (works even when offline)
      setCurrentUser(stripSecret(cached));
      setLoading(false);

      // Then verify it in the background
      try {
        const { data, error } = await supabase
          .from("users").select("*").eq("id", cached.id).maybeSingle();
        if (cancelled) return;

        // Network or server problem: keep the user signed in
        if (error) return;

        if (data && data.status === "accepted") {
          setCurrentUser(stripSecret(data));
          saveSession(data);
          await supabase.from("users")
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq("id", data.id);
        } else {
          // Account deleted, rejected or blocked: sign out now
          clearSession();
          setCurrentUser(null);
        }
      } catch { /* offline: keep the session */ }
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  // Keep all open tabs in sync (logout in one tab logs out the others)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== KEY) return;
      if (!e.newValue) { setCurrentUser(null); return; }
      try { setCurrentUser(stripSecret(JSON.parse(e.newValue))); } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Mark offline on unload
  useEffect(() => {
    if (!currentUser) return;
    const handleUnload = () => {
      supabase.from("users")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [currentUser]);

  const login = async (username, password) => {
    // NOTE: plain-text password comparison. For production, move this to a
    // Supabase Edge Function / Auth with hashed passwords.
    const { data, error } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
    if (error || !data) return { error: "User not found" };
    if (data.status === "pending") return { error: "Your account is awaiting admin approval." };
    if (data.status === "rejected") return { error: "Your account was not approved. Contact admin." };
    if (data.password_hash !== password) return { error: "Incorrect password." };

    saveSession(data); // saved WITHOUT the password
    await supabase.from("users")
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq("id", data.id);
    const safe = stripSecret(data);
    setCurrentUser(safe);
    return { data: safe };
  };

  // The ONLY place (besides deleteAccount) where the saved session is cleared
  const logout = async () => {
    const user = currentUser;
    clearSession();        // sign out instantly, even if the network is slow
    setCurrentUser(null);

    if (user) {
      try {
        await supabase.from("users")
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq("id", user.id);
      } catch { /* offline: ignore */ }
    }
  };

  // Merge changes (name, avatar...) into the signed-in user + saved session
  const updateCurrentUser = (patch) => {
    if (!currentUser) return;
    const merged = { ...currentUser, ...patch };
    setCurrentUser(merged);
    saveSession(merged);
  };

  // Permanently delete the account and everything it owns
  const deleteAccount = async () => {
    if (!currentUser) return { error: "Not signed in" };
    const id = currentUser.id;
    await supabase.from("pantweet_comments").delete().eq("user_id", String(id));
    await supabase.from("pantweets").delete().eq("user_id", id);
    await supabase.from("followers").delete().eq("follower_id", id);
    await supabase.from("followers").delete().eq("following_id", id);
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return { error: error.message };
    clearSession();
    try { localStorage.removeItem(`pandora_bookmarks_${id}`); } catch { /* ignore */ }
    setCurrentUser(null);
    return {};
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loading, updateCurrentUser, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);