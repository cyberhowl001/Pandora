import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { emailFor, USER_COLS } from "./authShared";
import { removeUserMedia } from "./storage";

const AuthContext = createContext(null);
const KEY = "pandora_user"; // cached PROFILE only (no password, no token): opens the app instantly / offline

const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const saveCache = (u) => { try { localStorage.setItem(KEY, JSON.stringify(u)); } catch { /* storage blocked */ } };
const clearCache = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

const isNetworkError = (e) => e && (e.name === "AuthRetryableFetchError" || /fetch|network/i.test(e.message || ""));

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);

  const apply = useCallback((u) => {
    userRef.current = u;
    setCurrentUser(u);
    if (u) saveCache(u); else clearCache();
  }, []);

  // Load the profile that belongs to a Supabase Auth account.
  // Returns { user } | { status } (pending / rejected) | { missing } (no profile, e.g. an admin) | { offline }
  const loadProfile = useCallback(async (authId) => {
    const { data, error } = await supabase.from("users").select(USER_COLS).eq("auth_id", authId).maybeSingle();
    if (error) return { offline: true };           // network problem: keep what we have
    if (!data) { apply(null); return { missing: true }; } // signed in, but has no profile (admin account)
    if (data.status !== "accepted") {
      apply(null);
      await supabase.auth.signOut({ scope: "local" });
      return { status: data.status };
    }
    apply(data);
    supabase.from("users").update({ is_online: true, last_seen: new Date().toISOString() }).eq("id", data.id)
      .then(() => {}, () => {});
    return { user: data };
  }, [apply]);

  // On app start: restore the Supabase session (stored by supabase-js, refreshed automatically)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { apply(null); setLoading(false); return; }

      const cached = readCache();
      if (cached?.auth_id === session.user.id) {      // show the saved profile straight away
        userRef.current = cached;
        setCurrentUser(cached);
        setLoading(false);
      }
      await loadProfile(session.user.id);              // then verify it in the background
      if (!cancelled) setLoading(false);
    })();

    // sign-in / sign-out in ANOTHER tab arrives here
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") apply(null);
      if (event === "SIGNED_IN" && session) {
        // do not call supabase inside this callback directly
        setTimeout(() => {
          if (userRef.current?.auth_id !== session.user.id) loadProfile(session.user.id);
        }, 0);
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [apply, loadProfile]);

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
    const name = (username || "").trim();
    if (!name || !password) return { error: "Enter your username and password." };
    const BAD = { error: "Incorrect username or password." };
    const NET = { error: "Could not reach the server. Check your connection." };

    let { data: email, error: e1 } = await supabase.rpc("login_email", { p_username: name });
    if (e1) { console.error("[login] login_email failed (was auth_1_prepare.sql run?):", e1); return NET; }

    // An old account with no Supabase login yet: create it now, using the password that was just typed.
    if (!email) {
      const { data: mig, error: mErr } = await supabase.functions.invoke("legacy-login", { body: { username: name, password } });
      if (mErr) console.warn("[login] legacy-login is not deployed or failed:", mErr);
      if (mig?.migrated) {
        const r = await supabase.rpc("login_email", { p_username: name });
        email = r.data;
      } else if (mig?.reason) {
        console.warn("[login] no login created:", mig.reason);
        if (mig.reason === "weak_password") {
          return { error: "Your old password is shorter than the new minimum. Please contact the admin to reset it." };
        }
        if (mig.reason === "too_many_attempts") return { error: "Too many attempts. Please wait a minute and try again." };
      }
    }
    if (!email) return BAD;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("[login] sign-in failed:", error.message);
      if (isNetworkError(error)) return NET;
      if (/not confirmed/i.test(error.message)) {
        return { error: "This account is not confirmed. Admin: turn OFF \u201cConfirm email\u201d in Supabase > Authentication > Providers > Email." };
      }
      return BAD;
    }

    const res = await loadProfile(data.user.id);
    if (res.user) return { data: res.user };
    if (res.status === "pending") return { error: "Your account is awaiting admin approval." };
    if (res.status === "suspended") return { error: "Your account is suspended.", suspended: true };
    if (res.status === "rejected") return { error: "Your account was not approved. Contact admin." };
    if (res.offline) return NET;
    console.warn("[login] signed in, but this account has no profile row");
    await supabase.auth.signOut({ scope: "local" });
    return { error: "Account not found." };
  };

  // Create an account. The profile row is created by the database in the same step.
  const register = async ({ surname, other_name, username, password, phone, phoneRaw, display_name, guidelines_version }) => {
    const { data: uTaken } = await supabase.rpc("username_taken", { p_username: username });
    if (uTaken) return { error: "Username already taken. Choose another." };
    const { data: pTaken } = await supabase.rpc("phone_taken", { p_phones: [phone, phoneRaw || phone] });
    if (pTaken) return { error: "This number has already been used." };

    const { data, error } = await supabase.auth.signUp({
      email: emailFor(username),
      password,
      options: { data: { surname, other_name, username, phone, display_name: (display_name || "").trim(), accepted_guidelines: true, guidelines_version } },
    });
    if (error) {
      console.error("[register] sign-up failed:", error);
      if (/database error/i.test(error.message)) {
        return { error: "Could not create your profile. Admin: see auth_fix_signup.sql (the database rejected the new profile)." };
      }
      if (/registered|exists/i.test(error.message)) return { error: "Username already taken. Choose another." };
      if (/password/i.test(error.message)) return { error: "Password is too weak. Use at least 6 characters." };
      if (isNetworkError(error)) return { error: "Could not reach the server. Check your connection." };
      return { error: "Registration failed. Please try again." };
    }
    if (!data.session) {
      return { error: "Account created, but e-mail confirmation is still ON in Supabase (Auth > Providers > Email)." };
    }
    const res = await loadProfile(data.user.id);
    return res.user ? { data: res.user } : { error: "Registration failed. Please try again." };
  };

  // sign out instantly in the UI, then tidy up
  const logout = async () => {
    const user = userRef.current;
    apply(null);
    try {
      if (user) {
        await supabase.from("users")
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq("id", user.id);
      }
    } catch { /* offline: ignore */ }
    await supabase.auth.signOut();
  };

  // Merge changes (name, avatar...) into the signed-in user + cached profile
  const updateCurrentUser = (patch) => {
    if (!userRef.current) return;
    apply({ ...userRef.current, ...patch });
  };

  // Permanently delete the account and everything it owns
  const deleteAccount = async () => {
    const u = userRef.current;
    if (!u) return { error: "Not signed in" };
    await removeUserMedia(u.id);                       // uploaded photos / videos
    const { error } = await supabase.rpc("delete_account", { p_user: String(u.id) });
    if (error) return { error: error.message };
    try { localStorage.removeItem(`pandora_bookmarks_${u.id}`); } catch { /* ignore */ }
    apply(null);
    await supabase.auth.signOut({ scope: "local" });
    return {};
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, loading, updateCurrentUser, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
