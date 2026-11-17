import { useState } from "react";
import { UserPlus, UserMinus, Flag } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useFollows } from "./FollowContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar, PageShell } from "./ui";
import { PostList } from "./PostCard";
import { ReportSheet } from "./Settings";
import { StatsPanel } from "./UserStats";
import { useUserPosts } from "./useUserPosts";
import { displayName, same } from "./utils";

// Another user's profile + their posts (opened from Search or Mutuals)
export default function UserView({ userId, onBack }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users } = usePosts();
  const { isFollowing, toggleFollow } = useFollows();
  const [reporting, setReporting] = useState(false);
  const user = users[userId];
  const { list: theirs, hasMore, loadMore, loading } = useUserPosts(userId);
  const own = same(userId, currentUser.id);

  if (!user) return <PageShell title="User" onBack={onBack}><p className={`text-center text-sm py-12 ${t.sub}`}>User not found</p></PageShell>;

  return (
    <PageShell title={`@${user.username}`} onBack={onBack}>
      <div className="flex flex-col items-center pt-2">
        <Avatar user={user} size={88} />
        <p className="font-black text-lg mt-2">{displayName(user)}</p>
        <p className={`text-sm ${t.sub}`}>@{user.username}{user.is_online && <span className="text-green-500"> · ● Online</span>}</p>
        {!own && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => toggleFollow(user.id)}
              className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${isFollowing(user.id) ? `${t.chip} ${t.sub}` : t.accent}`}
            >
              {isFollowing(user.id) ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
            </button>
            <button onClick={() => setReporting(true)} className="p-2.5 rounded-xl text-red-400 hover:bg-red-400/10"><Flag size={16} /></button>
          </div>
        )}
      </div>

      {/* joined date + lifetime likes / comments / reshares / interactions (kept after posts expire) */}
      <StatsPanel userId={user.id} />

      <h4 className="font-black text-sm pt-2">PanTweets</h4>
      <PostList posts={theirs} empty={loading ? "Loading…" : "No active PanTweets"} />
      {hasMore && (
        <button onClick={loadMore} className={`w-full py-2.5 rounded-xl text-sm font-bold ${t.chip}`}>Load more</button>
      )}
      {reporting && <ReportSheet preset={user} onClose={() => setReporting(false)} />}
    </PageShell>
  );
}