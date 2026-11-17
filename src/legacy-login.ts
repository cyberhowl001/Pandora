// Supabase Edge Function: supabase/functions/legacy-login/index.ts
// TEMPORARY migration helper. When an old user signs in and has no Supabase Auth account yet,
// the app calls this with the username + password they typed. If that matches the old stored
// password, the Auth account is created (password hashed by Supabase) and linked to the profile.
// So nobody has to re-register, and you do not need to run migrate-auth.mjs for them.
//
// Deploy:  supabase functions deploy legacy-login      (keep the default JWT check: the anon key passes it)
// REMOVE it (and the plain-text password column) once every user has signed in once / been migrated.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const AUTH_EMAIL_DOMAIN = "pandora.app"; // must match authShared.js
const emailFor = (username: string) => {
  const u = username.trim().toLowerCase();
  const plain = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(u);
  const local = plain ? u : "x-" + [...new TextEncoder().encode(u)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${local}@${AUTH_EMAIL_DOMAIN}`;
};

// best-effort brute-force guard: 5 tries per minute per username (per running instance)
const attempts = new Map<string, { n: number; t: number }>();
const tooMany = (key: string) => {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > 60_000) { attempts.set(key, { n: 1, t: now }); return false; }
  a.n++;
  return a.n > 5;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { username, password } = await req.json();
    const name = String(username ?? "").trim();
    const pw = String(password ?? "");
    if (!name || !pw) return json({ migrated: false });
    if (tooMany(name.toLowerCase())) return json({ migrated: false, reason: "too_many_attempts" }, 429);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows } = await admin.from("users")
      .select("id, username, password_hash, auth_id")
      .ilike("username", name.replace(/[\\%_]/g, "\\$&")).limit(5);
    const u = (rows ?? []).find((r) => r.username === name) ?? (rows ?? [])[0];

    if (!u) return json({ migrated: false, reason: "no_such_user" });
    if (u.auth_id) return json({ migrated: false, reason: "already_migrated" });   // a genuine wrong password
    if (!u.password_hash || u.password_hash !== pw) return json({ migrated: false, reason: "wrong_password" });

    const email = emailFor(u.username);
    let authId: string | null = null;

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password: pw, email_confirm: true, user_metadata: { skip_profile: true },
    });

    if (created?.user) {
      authId = created.user.id;
    } else if (cErr && /registered|exists/i.test(cErr.message)) {
      // an earlier attempt created the Auth account but never linked it: find it by signing in
      const probe = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: s } = await probe.auth.signInWithPassword({ email, password: pw });
      authId = s?.user?.id ?? null;
    } else if (cErr) {
      const weak = /password/i.test(cErr.message);
      return json({ migrated: false, reason: weak ? "weak_password" : cErr.message });
    }

    if (!authId) return json({ migrated: false, reason: "could_not_create_account" });
    const { error: lErr } = await admin.from("users").update({ auth_id: authId }).eq("id", u.id);
    if (lErr) return json({ migrated: false, reason: "could_not_link: " + lErr.message });

    return json({ migrated: true });
  } catch (e) {
    console.error(e);
    return json({ migrated: false, reason: "server_error" }, 500);
  }
});
