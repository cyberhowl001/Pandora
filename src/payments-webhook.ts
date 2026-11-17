// Supabase Edge Function: supabase/functions/payments-webhook/index.ts
// Paystack calls this after a payment. It verifies the signature AND re-checks the payment with Paystack
// before it activates an ad or credits a tip.
//
// Deploy:   supabase functions deploy payments-webhook --no-verify-jwt     (Paystack has no Supabase login)
// Then in the Paystack dashboard > Settings > API Keys & Webhooks, set the webhook URL to
//           https://<project-ref>.supabase.co/functions/v1/payments-webhook
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function validSignature(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  return mac === signature;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-paystack-signature"), secret))) {
    return new Response("bad signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return new Response("ignored", { status: 200 });

  const reference: string = event.data?.reference;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: pay } = await admin.from("payments").select("*").eq("id", reference).maybeSingle();
  if (!pay) return new Response("unknown payment", { status: 200 });
  if (pay.status === "paid") return new Response("already processed", { status: 200 }); // webhooks can repeat

  // never trust the webhook body alone: ask Paystack
  const vr = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const v = await vr.json();
  const ok = v?.data?.status === "success" && Number(v.data.amount) === pay.amount_minor && v.data.currency === pay.currency;
  if (!ok) {
    await admin.from("payments").update({ status: "failed" }).eq("id", pay.id);
    return new Response("verification failed", { status: 200 });
  }

  await admin.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", pay.id);

  if (pay.purpose === "promotion") await admin.rpc("activate_promotion", { p_id: pay.ref_id });
  if (pay.purpose === "tip") await admin.rpc("credit_tip", { p_payment: String(pay.id) });

  return new Response("ok", { status: 200 });
});
