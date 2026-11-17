import { useRef } from "react";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { PageShell } from "./ui";
import { PostList } from "./PostCard";
import { usePagedPosts, useNearEnd, queries } from "./postQueries";

// All live posts that use one #hashtag (opened by tapping a hashtag, or from Search > Trending)
export default function TopicPage() {
  const { t } = useTheme();
  const { topicTag, closeTopic } = usePosts();
  const { list, loading, hasMore, loadMore } = usePagedPosts(queries.tag(topicTag), topicTag);
  const end = useRef(null);
  useNearEnd(end, loadMore, hasMore && !loading);

  return (
    <PageShell title={`#${topicTag}`} onBack={closeTopic}>
      <PostList posts={list} empty={loading ? "Loading…" : `No active posts with #${topicTag} right now`} />
      {hasMore && <div ref={end} className="h-8" />}
      {loading && list.length > 0 && <p className={`text-center text-xs py-4 ${t.sub}`}>Loading…</p>}
    </PageShell>
  );
}
