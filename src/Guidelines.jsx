import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { Sheet } from "./ui";

// Change this when the rules change: every user is asked to accept the new version once.
export const GUIDELINES_VERSION = "2026-11";

const SECTIONS = [
  ["Who can use Pandora", [
    "You must be 18 or older.",
    "One account per person. Do not pretend to be someone else, and do not run fake or automated accounts.",
  ]],
  ["Be respectful", [
    "No hate speech or discrimination based on race, ethnicity, nationality, religion, gender, sexual orientation, disability, age or similar traits.",
    "No harassment, bullying, threats or insults aimed at people.",
    "Do not share other people's private information (home address, phone number, documents) without their consent.",
  ]],
  ["Keep people safe", [
    "No violence, threats or encouraging others to hurt anyone.",
    "Anything that sexualises or endangers children is banned. It is removed and, where the law requires, reported to the authorities.",
    "No selling or promoting illegal goods or services.",
  ]],
  ["Keep it clean", [
    "No nudity or sexually explicit content, and no graphic gore.",
  ]],
  ["Be honest", [
    "No scams, fraud, fake giveaways, spam, or buying and selling fake likes, views or followers.",
    "News posts must link their source. Posts found to be false or misleading may be labelled or removed.",
    "Do not impersonate people, brands or organisations.",
  ]],
  ["Businesses and ads", [
    "Promoted posts are labelled “Promoted”, reviewed before they run, and must be truthful.",
    "Ads must follow the advertising laws and rules that apply where you and your audience are.",
  ]],
  ["Your control", [
    "You can block or mute any account, and report any post or account from its ⋮ menu.",
    "Your phone number is never shown publicly.",
  ]],
  ["When the rules are broken", [
    "We may label or remove content, limit features, or suspend or delete accounts.",
    "If you think we got it wrong, appeal in Settings → Moderation & appeals.",
  ]],
];

export function GuidelinesBody() {
  return (
    <div className="space-y-4 text-sm">
      <p className="opacity-80">Pandora is for talking about what is happening now, creating, and growing, in a space that stays respectful. These rules apply to everyone.</p>
      {SECTIONS.map(([title, items]) => (
        <div key={title}>
          <h4 className="font-black mb-1">{title}</h4>
          <ul className="space-y-1.5 opacity-90">
            {items.map((x) => <li key={x} className="flex gap-2"><span>•</span><span>{x}</span></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

// read-only view (Settings, sign-up page)
export function GuidelinesSheet({ onClose }) {
  return (
    <Sheet title="Community Guidelines" onClose={onClose}>
      <GuidelinesBody />
      <p className="mt-6 text-xs opacity-60">Version {GUIDELINES_VERSION}</p>
    </Sheet>
  );
}

// shown once to every signed-in user who has not accepted the current version yet
export function GuidelinesGate() {
  const { currentUser, updateCurrentUser, logout } = useAuth();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!currentUser || currentUser.guidelines_version === GUIDELINES_VERSION) return null;

  const accept = async () => {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("accept_guidelines", { p_version: GUIDELINES_VERSION });
    setBusy(false);
    if (error) { console.error("[guidelines] could not save:", error); return setErr("Could not save. Check your connection."); }
    updateCurrentUser({ guidelines_version: GUIDELINES_VERSION });
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-3">
      <div className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-[#1a1a1a] text-white">
        <div className="border-b border-white/10 p-5">
          <h2 className="text-lg font-black">Community Guidelines</h2>
          <p className="text-xs text-gray-400">Please read and accept to keep using Pandora.</p>
        </div>
        <div className="flex-1 overflow-y-auto p-5"><GuidelinesBody /></div>
        <div className="space-y-3 border-t border-white/10 p-5">
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            I am 18 or older and I agree to follow the Community Guidelines.
          </label>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={accept} disabled={!agree || busy} className="w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-black disabled:opacity-50">
            {busy ? "Saving…" : "Accept and continue"}
          </button>
          <button onClick={logout} className="w-full py-1 text-xs text-gray-500 underline">Log out instead</button>
        </div>
      </div>
    </div>
  );
}
