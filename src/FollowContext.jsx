import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useNotifications } from "./NotificationsContext";
import { same } from "./utils";

const FollowContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useFollows = () => useContext(FollowContext);

export function FollowProvider({ children }) {
  const { currentUser } = useAuth();
  const { notify } = useNotifications();
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const a = await supabase.from("followers").select("following_id").eq("follower_id", currentUser.id);
      setFollowing((a.data || []).map((r) => r.following_id));
      const b = await supabase.from("followers").select("follower_id").eq("following_id", currentUser.id);
      setFollowers((b.data || []).map((r) => r.follower_id));
    })();
  }, [currentUser]);

  const isFollowing = (id) => following.some((x) => same(x, id));
  const mutuals = following.filter((id) => followers.some((f) => same(f, id)));

  const toggleFollow = async (targetId) => {
    if (isFollowing(targetId)) {
      await supabase.from("followers").delete().eq("follower_id", currentUser.id).eq("following_id", targetId);
      setFollowing((p) => p.filter((id) => !same(id, targetId)));
      notify(targetId, "unfollow");
    } else {
      await supabase.from("followers").insert([{ follower_id: currentUser.id, following_id: targetId }]);
      setFollowing((p) => [...p, targetId]);
      notify(targetId, "follow");
    }
  };

  return (
    <FollowContext.Provider value={{ following, followers, mutuals, isFollowing, toggleFollow }}>
      {children}
    </FollowContext.Provider>
  );
}