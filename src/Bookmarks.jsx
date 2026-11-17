import { useEffect } from "react";
import { usePosts } from "./PostsContext";
import { PageShell } from "./ui";
import { PostList } from "./PostCard";
import { same } from "./utils";

// Saved posts live in this device's localStorage (see PostsContext)
export default function Bookmarks({ onBack }) {
  const { bookmarks, posts, ensurePosts } = usePosts();

  // posts are loaded page by page now, so fetch the live copy of every saved post
  const idKey = bookmarks.map((b) => String(b.id)).join(",");
  useEffect(() => { if (idKey) ensurePosts(idKey.split(",")); }, [idKey, ensurePosts]);

  // use the live post (fresh likes / comments) if it still exists, otherwise the saved copy
  const list = bookmarks.map((b) => posts.find((p) => same(p.id, b.id)) || { ...b, files: b.files || [], likes: b.likes || [], views: b.views || [] });
  return (
    <PageShell title="Saved Bookmarks" onBack={onBack}>
      <PostList posts={list} empty="No saved posts yet. Tap the bookmark icon on any PanTweet." />
    </PageShell>
  );
}