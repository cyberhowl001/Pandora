import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check localStorage for persisted session
  useEffect(() => {
    const stored = localStorage.getItem("pandora_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Verify user still exists and is accepted
        supabase
          .from("users")
          .select("*")
          .eq("id", parsed.id)
          .eq("status", "accepted")
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              setCurrentUser(data);
              // Update online status
              supabase
                .from("users")
                .update({ is_online: true, last_seen: new Date().toISOString() })
                .eq("id", data.id);
            } else {
              localStorage.removeItem("pandora_user");
            }
            setLoading(false);
          });
      } catch {
        localStorage.removeItem("pandora_user");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Mark offline on unload
  useEffect(() => {
    const handleUnload = () => {
      if (currentUser) {
        supabase
          .from("users")
          .update({ is_online: false, last_seen: new Date().toISOString() })
          .eq("id", currentUser.id);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [currentUser]);

  const login = async (username, password) => {
    // Simple password comparison — in production use bcrypt via Edge Function
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !data) return { error: "User not found" };
    if (data.status === "pending")
      return { error: "Your account is awaiting admin approval." };
    if (data.status === "rejected")
      return { error: "Your account was not approved. Contact admin." };
    if (data.password_hash !== password)
      return { error: "Incorrect password." }; // swap for bcrypt check

    localStorage.setItem("pandora_user", JSON.stringify(data));
    await supabase
      .from("users")
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq("id", data.id);
    setCurrentUser(data);
    return { data };
  };

  const logout = async () => {
    if (currentUser) {
      await supabase
        .from("users")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", currentUser.id);
    }
    localStorage.removeItem("pandora_user");
    setCurrentUser(null);
  };

  const updateUser = (updates) => {
    setCurrentUser((prev) => ({ ...prev, ...updates }));
    const stored = localStorage.getItem("pandora_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      localStorage.setItem("pandora_user", JSON.stringify({ ...parsed, ...updates }));
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);