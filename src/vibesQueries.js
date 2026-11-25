import { supabase } from "../supabaseClient";

const PAGE = 12;
const nowIso = () => new Date().toISOString();

// live (not expired) videos, newest first. Each loader takes the cursor (created_at of the last
// post we have) and returns raw rows, exactly like the loaders in postQueries.js.
const videos = (before) => {
  let q = supabase.from("pantweets").select("*")
    .eq("type", "video")
    .gt("expires_at", nowIso())
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt("created_at", before);
  return q;
};

// simple engagement score, used only to order the For You page
const score = (r) => (r.likes?.length || 0) * 3 + (r.comment_count || 0) * 4 + (r.views?.length || 0);

export const vibesQueries = {
  // everyone, newest first, no ranking
  recents: async (before) => (await videos(before)).data || [],

  // everyone except you, most engaging first within each page.
  // The OLDEST row of the page stays last, because usePagedPosts uses the last row as the cursor.
  forYou: (myId) => async (before) => {
    const rows = (await videos(before).neq("user_id", myId)).data || [];
    if (rows.length < 3) return rows;
    const oldest = rows[rows.length - 1];
    const rest = rows.slice(0, -1).sort((a, b) => score(b) - score(a));
    return [...rest, oldest];
  },

  // only people you follow who follow you back
  mutuals: (ids) => async (before) => {
    if (!ids.length) return [];
    return (await videos(before).in("user_id", ids)).data || [];
  },
};

// People who have a live video right now (the "Starred" row), newest poster first
export async function starredUserIds() {
  const { data } = await supabase.from("pantweets").select("user_id")
    .eq("type", "video").gt("expires_at", nowIso())
    .order("created_at", { ascending: false }).limit(80);
  return [...new Set((data || []).map((r) => String(r.user_id)))].slice(0, 20);
}
