import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useUpdateAvailable, applyUpdate } from "./pwaUpdate";

// Appears only when a new version of Pandora has been downloaded. Nothing changes until "Update app" is tapped.
export default function UpdateBanner() {
  const available = useUpdateAvailable();
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!available || hidden) return null;

  return (
    <div className="fixed inset-x-3 top-3 md:left-auto md:right-4 md:w-96 z-[150]">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-[#1a1a1a] p-3 text-white shadow-2xl">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-400"><RefreshCw size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-tight">A new version is ready</p>
          <p className="text-xs leading-tight text-gray-400">Update to get the latest changes.</p>
        </div>
        <button
          onClick={() => { setBusy(true); applyUpdate(); }}
          disabled={busy}
          className="shrink-0 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-black disabled:opacity-60"
        >
          {busy ? "Updating…" : "Update app"}
        </button>
        <button onClick={() => setHidden(true)} className="shrink-0 p-1 text-gray-500 hover:text-white" title="Later"><X size={16} /></button>
      </div>
    </div>
  );
}
