// Supabase Edge Function: supabase/functions/checkout/index.ts
// Creates a Paystack hosted payment page for (a) an approved ad promotion, or (b) a tip to a creator.
// The browser never sees the secret key and cannot choose the price of an ad.
//
// Deploy:   supabase functions deploy checkout            (JWT check stays ON: only signed-in users)
// Secrets:  supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx APP_URL=https://your-app.com
//
// Paystack must be enabled for the currencies you charge (USD needs approval on your Paystack account).
// To use Stripe / Flutterwave instead, change only the "initialize payment" block below and the
// signature check in payments-webhook.ts: the rest of the system stays the same.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TIP_CURRENCIES = ["USD"];            // currencies accepted for tips
const TIP_MIN = 100, TIP_MAX = 100000;      // minor units (1.00 to 1000.00)
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const appUrl = Deno.env.get("APP_URL") ?? "";

    // who is calling? (me() is evaluated with the caller's own login)
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: me } = await asUser.rpc("me");
    if (!me) return json({ error: "Please sign in again." }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();

    let amount = 0, currency = "", email = "", refId = "", toUser: string | null = null;

    if (body.purpose === "promotion") {
      const { data: pr } = await admin.from("promotions")
        .select("id, owner_id, status, contact_email, package_id").eq("id", body.promotion_id).maybeSingle();
      if (!pr || String(pr.owner_id) !== String(me) || pr.status !== "approved_unpaid") {
        return json({ error: "This promotion cannot be paid right now." }, 400);
      }
      const { data: pkg } = await admin.from("ad_packages").select("price_minor, currency").eq("id", pr.package_id).single();
      amount = pkg.price_minor; currency = pkg.currency; email = pr.contact_email; refId = String(pr.id);

    } else if (body.purpose === "tip") {
      const { data: creator } = await admin.from("users")
        .select("id, monetized, status").eq("id", body.creator_id).maybeSingle();
      if (!creator || !creator.monetized || creator.status !== "accepted" || String(creator.id) === String(me)) {
        return json({ error: "This creator cannot receive tips." }, 400);
      }
      amount = Math.round(Number(body.amount_minor));
      currency = String(body.currency || "");
      email = String(body.email || "").trim();
      if (!(amount >= TIP_MIN && amount <= TIP_MAX) || !TIP_CURRENCIES.includes(currency) || !emailOk(email)) {
        return json({ error: "Invalid tip details." }, 400);
      }
      refId = body.post_id ? String(body.post_id) : "";
      toUser = String(creator.id);

    } else {
      return json({ error: "Unknown purpose." }, 400);
    }

    // our own record first: its id becomes the payment reference
    const { data: pay, error: pErr } = await admin.from("payments").insert({
      user_id: String(me), purpose: body.purpose, ref_id: refId || null, to_user: toUser,
      amount_minor: amount, currency, provider: "paystack",
    }).select("id").single();
    if (pErr) return json({ error: "Could not create the payment." }, 500);

    // ---- initialize payment (swap this block to change provider) ----
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email, amount, currency, reference: pay.id,
        callback_url: `${appUrl}/?paid=1`,
        metadata: { purpose: body.purpose, ref_id: refId },
      }),
    });
    const out = await res.json();
    if (!res.ok || !out?.data?.authorization_url) {
      await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
      return json({ error: "The payment provider rejected the request." }, 502);
    }
    return json({ url: out.data.authorization_url });
  } catch (e) {
    console.error(e);
    return json({ error: "Unexpected error." }, 500);
  }
});
