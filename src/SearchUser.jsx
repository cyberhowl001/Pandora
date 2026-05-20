import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { Search, X, MessageCircle, User } from "lucide-react";
import DirectChat from "./DirectChat";

/**
 * SearchUsers
 * ──────────────────────────────────────────────────────────────────────
 * Searches ALL registered users in the `profiles` table (or falls back
 * to the auth admin view via a public RPC) by display name or email.
 *
 * Prerequisites – one of the following must exist in your Supabase project:
 *
 *  Option A (recommended):  a `profiles` table with columns:
 *    id          uuid  (= auth.users.id)
 *    full_name   text
 *    email       text
 *    avatar_url  text  (nullable)
 *
 *  Option B: a Postgres function `search_users(query text)` that returns
 *    rows with the same four columns above.
 *
 * The component tries Option A first; if the table doesn't exist it
 * gracefully shows an empty state.
 * ──────────────────────────────────────────────────────────────────────
 */
export default function SearchUsers({ isDarkMode = false }) {
  const [session, setSession] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // opens DirectChat
  const debounceRef = useRef(null);

  /* ── session ── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  /* ── search ── */
  const runSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
        .neq("id", session?.user?.id)   // exclude self
        .limit(20);

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error("SearchUsers error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
  };

  /* ── helpers ── */
  const getInitials = (name, email) => {
    if (name) {
      const p = name.trim().split(" ");
      return p.length >= 2
        ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }
    return email ? email.substring(0, 2).toUpperCase() : "??";
  };

  /* ── if DirectChat is open ── */
  if (selectedUser) {
    return (
      <DirectChat
        isDarkMode={isDarkMode}
        session={session}
        targetUser={selectedUser}
        onClose={() => setSelectedUser(null)}
      />
    );
  }

  /* ── styles ── */
  const dark = isDarkMode;
  const bg       = dark ? "#111"        : "#ffffff";
  const surface  = dark ? "#1a1a1a"     : "#f9f5f0";
  const border   = dark ? "#2e2e2e"     : "#e8ddd0";
  const text      = dark ? "#f0f0f0"    : "#1a1a1a";
  const subtext   = dark ? "#888"       : "#888";
  const inputBg   = dark ? "#0d0d0d"    : "#fff";
  const amber     = "#f59e0b";
  const amberHov  = "#d97706";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        borderRadius: "20px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        overflow: "hidden",
        border: `1px solid ${border}`,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${border}`,
          background: surface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Search size={18} color={amber} />
          <span style={{ fontWeight: 700, fontSize: 15, color: text, letterSpacing: "-0.3px" }}>
            Find People
          </span>
        </div>

        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: inputBg,
            border: `1.5px solid ${query ? amber : border}`,
            borderRadius: 12,
            padding: "8px 12px",
            gap: 8,
            transition: "border-color 0.2s",
          }}
        >
          <Search size={15} color={query ? amber : subtext} />
          <input
            value={query}
            onChange={handleChange}
            placeholder="Search by name or email…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: text,
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              onClick={clearSearch}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
            >
              <X size={14} color={subtext} />
            </button>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: subtext, fontSize: 13 }}>
            Searching…
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 8, padding: "32px 16px", color: subtext,
            }}
          >
            <User size={36} color={border} />
            <p style={{ fontSize: 13, margin: 0 }}>No users found for "{query}"</p>
          </div>
        )}

        {!loading && !query && (
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 8, padding: "32px 16px", color: subtext,
            }}
          >
            <Search size={36} color={border} />
            <p style={{ fontSize: 13, margin: 0, textAlign: "center" }}>
              Type a name or email to find users
            </p>
          </div>
        )}

        {!loading && results.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isDarkMode={dark}
            text={text}
            subtext={subtext}
            border={border}
            amber={amber}
            amberHov={amberHov}
            surface={surface}
            onChat={() => setSelectedUser(user)}
            getInitials={getInitials}
          />
        ))}
      </div>
    </div>
  );
}

/* ── UserRow sub-component ── */
function UserRow({ user, isDarkMode, text, subtext, border, amber, surface, onChat, getInitials }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        cursor: "pointer",
        background: hovered ? surface : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Avatar */}
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.full_name}
          style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 40, height: 40, borderRadius: "50%",
            background: `linear-gradient(135deg, ${amber}, #f97316)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0,
            letterSpacing: "0.5px",
          }}
        >
          {getInitials(user.full_name, user.email)}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.full_name || user.email.split("@")[0]}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: subtext, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {user.email}
        </p>
      </div>

      {/* Chat button */}
      <button
        onClick={onChat}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 12px", borderRadius: 20,
          background: hovered ? amber : "transparent",
          border: `1.5px solid ${hovered ? amber : border}`,
          color: hovered ? "#fff" : subtext,
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          transition: "all 0.2s", whiteSpace: "nowrap",
          fontFamily: "inherit",
        }}
      >
        <MessageCircle size={13} />
        Chat
      </button>
    </div>
  );
}