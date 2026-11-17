import { useEffect, useRef, useState } from "react";
import { Search, TrendingUp, Hash } from "lucide-react";
import { useAuth } from "./AuthContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { PostList } from "./PostCard";
import { AuthorBadges } from "./PostParts";
import { usePagedPosts, useNearEnd, queries, trendingTags } from "./postQueries";
import { displayName, same } from "./utils";

// post search results (only mounted when there is something to search)
function PostResults({ term }) {
  const { t } = useTheme();
  const { list, loading, hasMore, loadMore } = usePagedPosts(queries.search(term), term);
  const end = useRef(null);
  useNearEnd(end, loadMore, hasMore && !loading);
  if (!loading && !list.length) return <p className={`text-center text-sm py-12 ${t.sub}`}>No posts found</p>;
  return (
    <>
      <PostList posts={list} />
      {hasMore && <div ref={end} className="h-8" />}
      {loading && <p className={`text-center text-xs py-4 ${t.sub}`}>Loading…</p>}
    </>
  );
}

// Search people, posts and topics
export default function SearchTab({ nav }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users, openTopic } = usePosts();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState("people"); // people | posts
  const [trending, setTrending] = useState([]);

  useEffect(() => { const id = setTimeout(() => setTerm(q.trim()), 350); return () => clearTimeout(id); }, [q]);
  useEffect(() => { trendingTags().then(setTrending); }, []);

  const isTag = term.startsWith("#");
  const lower = term.toLowerCase();
  const people = term && !isTag
    ? Object.values(users).filter((u) => !same(u.id, currentUser.id) &&
        `${u.username} ${displayName(u)}`.toLowerCase().includes(lower))
    : [];
  const tagMatches = isTag ? trending.filter((x) => x.tag.startsWith(lower.slice(1))) : [];

  return (
    <div className="p-3">
      <div className={`flex items-center gap-2 border rounded-2xl px-3 py-2.5 mb-3 ${t.input}`}>
        <Search size={16} className={t.accentText} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, posts or #topics…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      {/* nothing typed: what is trending now */}
      {!term && (
        <div>
          <p className="flex items-center gap-1.5 font-black text-sm mb-2"><TrendingUp size={15} className="text-violet-500" /> Trending now</p>
          {trending.length === 0 && <p className={`text-sm py-8 text-center ${t.sub}`}>No trending topics yet. Use #hashtags in your posts.</p>}
          <div className="space-y-1">
            {trending.map((x, i) => (
              <button key={x.tag} onClick={() => openTopic(x.tag)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left ${t.card}`}>
                <span className={`text-xs font-bold w-5 ${t.sub}`}>{i + 1}</span>
                <span className="flex-1 font-bold text-sm truncate">#{x.tag}</span>
                <span className={`text-xs ${t.sub}`}>{x.posts} {Number(x.posts) === 1 ? "post" : "posts"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* #topic */}
      {term && isTag && (
        <div className="space-y-1">
          {lower.length > 1 && (
            <button onClick={() => openTopic(lower.slice(1))} className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left ${t.card}`}>
              <Hash size={16} className="text-violet-500" /><span className="font-bold text-sm">Open {lower}</span>
            </button>
          )}
          {tagMatches.map((x) => (
            <button key={x.tag} onClick={() => openTopic(x.tag)} className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left ${t.card}`}>
              <span className="flex-1 font-bold text-sm">#{x.tag}</span><span className={`text-xs ${t.sub}`}>{x.posts} posts</span>
            </button>
          ))}
        </div>
      )}

      {/* people / posts */}
      {term && !isTag && (
        <>
          <div className={`flex p-1 rounded-2xl mb-3 ${t.chip.split(" ")[0]}`}>
            {[["people", "People"], ["posts", "Posts"]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${tab === k ? t.accent : t.sub}`}>{label}</button>
            ))}
          </div>

          {tab === "people" && (
            <div className="space-y-2">
              {people.length === 0 && <p className={`text-center text-sm py-12 ${t.sub}`}>No users found</p>}
              {people.map((u) => (
                <button key={u.id} onClick={() => nav("user", { userId: u.id })} className={`w-full flex items-center gap-3 p-3 rounded-2xl border ${t.card}`}>
                  <Avatar user={u} size={42} />
                  <span className="text-left flex-1 min-w-0">
                    <span className="block font-bold text-sm truncate">{displayName(u)}<AuthorBadges user={u} /></span>
                    <span className={`block text-xs truncate ${t.sub}`}>@{u.username}{u.category ? ` · ${u.category}` : ""}</span>
                  </span>
                  {u.is_online && <span className="text-xs text-green-500 font-medium">● Online</span>}
                </button>
              ))}
            </div>
          )}
          {tab === "posts" && (term.length >= 2 ? <PostResults term={term} /> : <p className={`text-center text-sm py-12 ${t.sub}`}>Type at least 2 characters</p>)}
        </>
      )}
    </div>
  );
}
