import { useEffect, useState } from "react";
import { Download, X, Share, MoreVertical, PlusSquare } from "lucide-react";
import { useInstall } from "./installPrompt";

// ---- tune the behaviour here ------------------------------------------------------------
const REMIND_AFTER_MINUTES = 5;   // after "Not now" the banner comes back after this long. 0 = never hide it.
const HIDE_ONCE_INSTALLED = true; // stop showing it in this browser after the app was installed
// -----------------------------------------------------------------------------------------

const DISMISS_KEY = "pandora_install_dismissed_at";
const INSTALLED_KEY = "pandora_installed";

const readDismissed = () => { try { return Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch { return 0; } };
const wasInstalled = () => { try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; } };

// what to tap when the browser has no one-tap install
const STEPS = {
  "ios-safari": [[Share, "Tap the Share button at the bottom of Safari"], [PlusSquare, "Scroll down and tap “Add to Home Screen”"], [Download, "Tap “Add”"]],
  "ios-other": [[Share, "Open this page in Safari (installing only works there on iPhone / iPad)"], [Share, "Tap Share, then “Add to Home Screen”"]],
  "android-chrome": [[MoreVertical, "Tap the ⋮ menu at the top right of Chrome"], [Download, "Tap “Install app” (or “Add to Home screen”)"]],
  "android-samsung": [[MoreVertical, "Tap the menu (☰) in Samsung Internet"], [Download, "Tap “Add page to” → “Home screen”"]],
  "android-firefox": [[MoreVertical, "Tap the ⋮ menu in Firefox"], [Download, "Tap “Install”"]],
  "desktop-chrome": [[Download, "Click the install icon at the right of the address bar"], [MoreVertical, "Or open the ⋮ menu → “Install Pandora…”"]],
  "desktop-edge": [[Download, "Click the install icon at the right of the address bar"], [MoreVertical, "Or open the ··· menu → Apps → “Install this site as an app”"]],
  "desktop-safari": [[Share, "In the menu bar choose File → “Add to Dock…”"]],
  "desktop-firefox": [[Download, "Firefox on computers cannot install web apps. Open Pandora in Chrome or Edge to install it."]],
};

export default function InstallBanner() {
  const { standalone, installedThisSession, nativeReady, platform, install } = useInstall();
  const [dismissedAt, setDismissedAt] = useState(readDismissed);
  const [, tick] = useState(0);
  const [help, setHelp] = useState(false);

  // re-evaluate every 15 seconds so the banner can come back by itself
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const hiddenByDismiss =
    REMIND_AFTER_MINUTES > 0 && dismissedAt && Date.now() - dismissedAt < REMIND_AFTER_MINUTES * 60000;

  if (standalone) return null;                                         // already the installed app
  if (HIDE_ONCE_INSTALLED && (installedThisSession || wasInstalled())) return null;
  if (hiddenByDismiss && !help) return null;

  const dismiss = () => {
    const now = Date.now();
    try { localStorage.setItem(DISMISS_KEY, String(now)); } catch { /* ignore */ }
    setDismissedAt(now);
    setHelp(false);
  };

  const onInstall = async () => {
    if (nativeReady) {
      const outcome = await install();
      if (outcome === "dismissed") dismiss();
    } else {
      setHelp(true);                // the browser has not offered one-tap install: show the manual steps
    }
  };

  const steps = STEPS[platform] || STEPS["desktop-chrome"];

  return (
    <>
      {!help && (
        <div className="fixed inset-x-3 bottom-[72px] md:bottom-4 md:left-auto md:right-4 md:w-96 z-[120]">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-[#1a1a1a] p-3 shadow-2xl text-white">
            <img src="/panda.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black leading-tight">Install Pandora</p>
              <p className="text-xs text-gray-400 leading-tight">Faster, full screen, and one tap from your home screen.</p>
            </div>
            <button onClick={onInstall} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-black">
              <Download size={14} /> Install
            </button>
            {REMIND_AFTER_MINUTES > 0 && (
              <button onClick={dismiss} className="shrink-0 p-1 text-gray-500 hover:text-white" title="Not now"><X size={16} /></button>
            )}
          </div>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center bg-black/60 p-3" onClick={() => setHelp(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1a] p-5 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <img src="/panda.png" alt="" className="w-10 h-10 rounded-xl" />
              <h3 className="flex-1 font-black text-lg">Install Pandora</h3>
              <button onClick={() => setHelp(false)} className="p-1 text-gray-400"><X size={18} /></button>
            </div>
            <ol className="space-y-3">
              {steps.map(([Icon, text], i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400"><Icon size={14} /></span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => setHelp(false)} className="mt-5 w-full rounded-xl bg-amber-400 py-2.5 text-sm font-black text-black">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
