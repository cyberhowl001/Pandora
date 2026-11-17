import { useCallback, useEffect, useRef, useState } from "react";
import { usePosts } from "./PostsContext";
import { same } from "./utils";

// A user's active posts, loaded from the server 10 at a time.
// `list` is read from the shared loaded set, so likes / views / realtime updates stay live.
export function useUserPosts(userId) {
  const { posts, loadUserPosts } = usePosts();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const cursor = useRef(null);

  const run = useCallback(async (reset) => {
    setLoading(true);
    if (reset) cursor.current = null;
    const { rows, more } = await loadUserPosts(userId, cursor.current);
    if (rows.length) cursor.current = rows[rows.length - 1].created_at;
    setHasMore(more);
    setLoading(false);
  }, [userId, loadUserPosts]);

  useEffect(() => { run(true); }, [run]);

  return {
    list: posts.filter((p) => same(p.user_id, userId)),
    hasMore,
    loading,
    loadMore: () => run(false),
  };
}