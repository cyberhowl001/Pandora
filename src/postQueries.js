import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { usePosts, mapRow } from "./PostsContext";

const PAGE = 12;
const nowIso = () => new Date().toISOString();

// Each query takes the cursor (created_at of the last post we have) and returns raw rows, newest first.
export const queries = {
  // photos + videos (kind "all") or videos only (kind "video")
  media: (kind) => async (before) => {
    let q = supabase.from("pantweets").select("*")
      .gt("expires_at", nowIso()).order("created_at", { ascending: false }).limit(PAGE);
    q = kind === "video" ? q.eq("type", "video") : q.in("type", ["image", "video"]);
    if (before) q = q.lt("created_at", before);
    const { data } = await q;
    return data || [];
  },
  tag: (tag) => async (before) => {
    const { data } = await supabase.rpc("posts_by_tag", { p_tag: tag, p_before: before, p_limit: PAGE });
    return data || [];
  },
  search: (term) => async (before) => {
    const { data } = await supabase.rpc("search_posts", { p_q: term, p_before: before, p_limit: PAGE });
    return data || [];
  },
};

export const trendingTags = async () => (await supabase.rpc("trending_tags", { p_limit: 15 })).data || [];

// Paged list of posts. `key` changes -> the list reloads. Posts are stored in the shared context,
// so likes, views and realtime updates stay live inside these lists.
export function usePagedPosts(load, key) {
  const { ingest, posts } = usePosts();
  const [ids, setIds] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const cursor = useRef(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (reset) => {
    setLoading(true);
    if (reset) cursor.current = null;
    const rows = await loadRef.current(cursor.current);
    ingest(rows);
    const got = rows.map((r) => String(r.id));
    setIds((prev) => (reset ? got : [...prev, ...got.filter((i) => !prev.includes(i))]));
    if (rows.length) cursor.current = rows[rows.length - 1].created_at;
    setHasMore(rows.length >= PAGE);
    setLoading(false);
  }, [ingest]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(true); }, [key]);

  const byId = new Map(posts.map((p) => [String(p.id), p]));
  return {
    list: ids.map((i) => byId.get(i)).filter(Boolean),
    loading, hasMore,
    loadMore: () => { if (!loading) run(false); },
  };
}

// calls `cb` when the element comes near the screen (infinite scroll)
export function useNearEnd(ref, cb, enabled) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) cbRef.current(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, enabled]);
}

// Promoted posts for the feed. Loaded once; impressions are counted once per session.
const counted = new Set();
export function useAds() {
  const { ingest } = usePosts();
  const [ads, setAds] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.rpc("active_promotions", { p_limit: 6 }).then(({ data }) => {
      if (!alive || !data) return;
      const list = data.map((a) => ({ ...a, post: mapRow(a.post) }));
      ingest(list.map((a) => a.post));
      setAds(list);
    });
    return () => { alive = false; };
  }, [ingest]);
  return ads;
}

export const logAd = (promotionId, event) => {
  if (event === "impression") {
    if (counted.has(promotionId)) return;
    counted.add(promotionId);
  }
  supabase.rpc("ad_event", { p_promotion: String(promotionId), p_event: event }).then(() => {}, () => {});
};

// Posts the admin team featured. Real posts with their real numbers; the feed just shows them to more people.
export function useFeatured() {
  const { ingest, posts } = usePosts();
  const [ids, setIds] = useState([]);
  useEffect(() => {
    let alive = true;
    supabase.from("pantweets").select("*")
      .gt("featured_until", nowIso()).gt("expires_at", nowIso())
      .order("featured_until", { ascending: false }).limit(5)
      .then(({ data }) => {
        if (!alive || !data) return;
        ingest(data);
        setIds(data.map((r) => String(r.id)));
      });
    return () => { alive = false; };
  }, [ingest]);
  const byId = new Map(posts.map((p) => [String(p.id), p]));
  return ids.map((i) => byId.get(i)).filter(Boolean);
}
