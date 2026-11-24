import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { useTheme } from "./theme";

export const BIO_MAX_WORDS = 30;

export const countWords = (s) => (s && s.trim() ? s.trim().split(/\s+/).length : 0);

// keeps at most 30 words (also when a long text is pasted)
export const clampWords = (s, max = BIO_MAX_WORDS) => {
  if (countWords(s) <= max) return s;
  return s.trim().split(/\s+/).slice(0, max).join(" ");
};

// read-only line shown on other people's profiles
export function BioText({ bio }) {
  const { t } = useTheme();
  if (!bio || !bio.trim()) return null;
  return <p className={`mt-2 max-w-sm px-4 text-center text-sm leading-snug ${t.text}`}>{bio}</p>;
}

// "Tell people about yourself": editable box under the profile picture (max 30 words)
export function BioBox() {
  const { t } = useTheme();
  const { currentUser, updateCurrentUser } = useAuth();
  const saved = currentUser.bio || "";
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const words = countWords(text);
  const changed = text.trim() !== saved.trim();

  const save = async () => {
    setBusy(true);
    setMsg("");
    const bio = text.trim() || null;
    const { error } = await supabase.from("users").update({ bio }).eq("id", currentUser.id);
    setBusy(false);
    if (error) {
      console.error("[bio] save failed:", error);
      return setMsg("Could not save. Check your connection.");
    }
    updateCurrentUser({ bio });
    setMsg("Saved ✓");
  };

  return (
    <div className="mt-3 w-full max-w-sm">
      <textarea
        value={text}
        onChange={(e) => { setText(clampWords(e.target.value)); setMsg(""); }}
        rows={2}
        placeholder="Tell people about yourself…"
        className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${t.input}`}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`text-xs ${words >= BIO_MAX_WORDS ? "text-amber-500 font-bold" : t.sub}`}>{words}/{BIO_MAX_WORDS} words</span>
        {msg && <span className={`text-xs ${msg.includes("✓") ? "text-green-500" : "text-red-400"}`}>{msg}</span>}
        {changed && (
          <button onClick={save} disabled={busy} className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-50 ${t.accent}`}>
            <Check size={12} /> {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
