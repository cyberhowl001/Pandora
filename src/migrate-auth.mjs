// One-off: creates a Supabase Auth account for every existing user, using the password
// they already have, and links it to their profile. Nobody has to re-register.
//
//   npm i @supabase/supabase-js
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_KEY=<service_role key> node migrate-auth.mjs
//
// Run it from your own computer (never put the service_role key in the app), AFTER auth_1_prepare.sql
// and BEFORE auth_2_lockdown.sql. Safe to run again: finished users are skipped.
// Before running: in Supabase > Authentication > Providers > Email turn OFF "Confirm email",
// and set the minimum password length low enough for your existing passwords (default is 6).
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY");
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const AUTH_EMAIL_DOMAIN = "pandora.app"; // must match authShared.js
const emailFor = (username) => {
  const u = username.trim().toLowerCase();
  const plain = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(u);
  return `${plain ? u : "x-" + Buffer.from(u, "utf8").toString("hex")}@${AUTH_EMAIL_DOMAIN}`;
};

let done = 0;
const problems = [];
const PAGE = 500;

for (let from = 0; ; from += PAGE) {
  const { data: users, error } = await sb
    .from("users").select("id, username, password_hash, auth_id")
    .is("auth_id", null).order("created_at").range(from, from + PAGE - 1);
  if (error) throw error;
  if (!users.length) break;

  for (const u of users) {
    if (!u.username || !u.password_hash) { problems.push([u.username || u.id, "missing username or password"]); continue; }
    const { data, error: cErr } = await sb.auth.admin.createUser({
      email: emailFor(u.username),
      password: u.password_hash,                 // the old plain-text password becomes a properly hashed one
      email_confirm: true,
      user_metadata: { skip_profile: true },     // the profile already exists
    });
    if (cErr) { problems.push([u.username, cErr.message]); continue; }

    const { error: lErr } = await sb.from("users").update({ auth_id: data.user.id }).eq("id", u.id);
    if (lErr) { problems.push([u.username, "created but not linked: " + lErr.message]); continue; }
    done++;
    console.log("migrated", u.username);
  }
  if (users.length < PAGE) break;
}

console.log(`\nDone. migrated: ${done}, problems: ${problems.length}`);
for (const [who, why] of problems) console.log(" -", who, "->", why);
if (problems.length) console.log("\nFix these users (e.g. lower the min password length, rename duplicates) and run the script again.");
