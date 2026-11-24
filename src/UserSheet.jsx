import { useEffect, useState } from "react";
import { UserPlus, UserMinus, ExternalLink } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useFollows } from "./FollowContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import { StatsView, useUserStats } from "./UserStats";
import { BioText } from "./Bio";
import { displayName, fmt, same } from "./utils";

// Slides up from the bottom to 80% of the screen when a user's photo is tapped
export default function UserSheet({ nav }) {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const { users, profileUserId: userId, closeUserSheet, openPost } = usePosts();
  const { isFollowing, toggleFollow, following } = useFollows();
  const [shown, setShown] = useState(false);

  const user = users[userId];
  const own = same(userId, currentUser.id);
  // refetch counts whenever my following list changes
  const s = useUserStats(userId, following.length);

  // slide in on mount
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 15);
    return () => clearTimeout(id);
  }, []);

  // slide out, then unmount
  const close = (after) => {
    setShown(false);
    setTimeout(() => { closeUserSheet(); if (after) after(); }, 280);
  };

  const viewFull = () => close(() => {
    openPost(null); // close an open post sheet so the page is visible
    if (own) nav("profile"); else nav("user", { userId });
  });

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        onClick={() => close()}
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`absolute bottom-0 inset-x-0 mx-auto w-full max-w-xl h-[80dvh] rounded-t-3xl border-t shadow-2xl flex flex-col transition-transform duration-300 ease-out ${t.page} ${t.text} ${t.line}`}
        style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-gray-400/50" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {!user ? (
            <p className={`text-center text-sm py-16 ${t.sub}`}>User not found</p>
          ) : (
            <>
              <div className="flex flex-col items-center pt-3">
                <Avatar user={user} size={96} />
                <p className="font-black text-xl mt-3">{displayName(user)}</p>
                <p className={`text-sm ${t.sub}`}>
                  @{user.username}
                  {user.is_online && <span className="text-green-500"> · ● Online</span>}
                </p>
                <BioText bio={user.bio} />

                <div className="flex gap-10 mt-4 text-center">
                  <div><p className="font-black text-lg">{s ? fmt(s.followers) : "–"}</p><p className={`text-xs ${t.sub}`}>Followers</p></div>
                  <div><p className="font-black text-lg">{s ? fmt(s.following) : "–"}</p><p className={`text-xs ${t.sub}`}>Following</p></div>
                </div>

                <div className="flex gap-2 mt-4 w-full max-w-xs">
                  {!own && (
                    <button
                      onClick={() => toggleFollow(user.id)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 ${isFollowing(user.id) ? `${t.chip} ${t.sub}` : t.accent}`}
                    >
                      {isFollowing(user.id) ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
                    </button>
                  )}
                  <button onClick={viewFull} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 ${t.chip}`}>
                    <ExternalLink size={14} /> Full profile
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <StatsView s={s} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
