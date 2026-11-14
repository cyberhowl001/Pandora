import { useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { displayName, same } from "./utils";

// Search people, tap one to see their profile and posts
export default function SearchTab({ nav }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users } = usePosts();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const results = term
    ? Object.values(users).filter((u) => !same(u.id, currentUser.id) &&
        `${u.username} ${displayName(u)}`.toLowerCase().includes(term))
    : [];
  return (
    <div className="p-3">
      <div className={`flex items-center gap-2 border rounded-2xl px-3 py-2.5 mb-3 ${t.input}`}>
        <Search size={16} className={t.accentText} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by username or name…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      {!term && <p className={`text-center text-sm py-12 ${t.sub}`}>Find people and see their PanTweets</p>}
      {term && results.length === 0 && <p className={`text-center text-sm py-12 ${t.sub}`}>No users found</p>}
      <div className="space-y-2">
        {results.map((u) => (
          <button key={u.id} onClick={() => nav("user", { userId: u.id })} className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${t.card}`}>
            <Avatar user={u} size={42} />
            <span className="text-left flex-1 min-w-0">
              <span className="block font-bold text-sm truncate">{displayName(u)}</span>
              <span className={`block text-xs truncate ${t.sub}`}>@{u.username}</span>
            </span>
            {u.is_online && <span className="text-xs text-green-500 font-medium">● Online</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
