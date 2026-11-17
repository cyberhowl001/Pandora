// Supabase Auth needs an e-mail, but Pandora users sign in with a username.
// At sign-up the username is turned into a private e-mail that is never shown or used for mail.
// If Supabase rejects this domain, change it here AND in migrate-auth.mjs to a domain you own.
export const AUTH_EMAIL_DOMAIN = "pandora.app";

export const emailFor = (username) => {
  const u = username.trim().toLowerCase();
  const plain = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(u);
  const local = plain ? u : "x-" + [...new TextEncoder().encode(u)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${local}@${AUTH_EMAIL_DOMAIN}`;
};

// The only columns of `users` the app may read (phone and password are not readable at all)
export const USER_COLS = "id, auth_id, surname, other_name, username, avatar, status, is_online, last_seen, created_at, account_type, verified, monetized, bio, website, category, status_reason";
