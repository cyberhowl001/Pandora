// Supabase Edge Function: supabase/functions/cleanup-expired/index.ts
// Deletes posts that expired more than 1 hour ago, together with their files in Storage
// and their comments. Lifetime stats live in user_stats, so profiles keep their totals.
//
// Deploy:   supabase functions deploy cleanup-expired --no-verify-jwt
// Secret:   supabase secrets set CLEANUP_SECRET=<a long random string>
// Schedule: Dashboard > Integrations > Cron > new job, every hour, HTTP request to the
//           function URL with header  Authorization: Bearer <the same secret>
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CLEANUP_SECRET")}`) {
    return new Response("forbidden", { status: 403 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cutoff = new Date(Date.now() - 3600_000).toISOString();

  const { data: rows, error } = await sb
    .from("pantweets").select("id, files").lt("expires_at", cutoff).limit(200);
  if (error) return new Response(error.message, { status: 500 });
  if (!rows?.length) return Response.json({ deleted: 0, files: 0 });

  const ids = rows.map((r) => r.id);
  const paths = rows.flatMap((r) => (r.files ?? []).map((f: { path?: string }) => f.path).filter(Boolean)) as string[];

  if (paths.length) await sb.storage.from("media").remove(paths);
  await sb.from("pantweet_comments").delete().in("post_id", ids.map(String));
  await sb.from("pantweets").delete().in("id", ids);

  return Response.json({ deleted: ids.length, files: paths.length });
});
