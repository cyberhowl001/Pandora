import { useEffect, useRef, useState } from "react";
import { Home, Search, Box, Bell, MessageCircle } from "lucide-react";
import { useNotifications } from "./NotificationsContext";
import Recents from "./Recents";
import ForYou from "./ForYou";
import VibesMutuals from "./VibesMutuals";

const PAGES = [
  ["recents", "Recents", Recents],
  ["foryou", "For You", ForYou],
  ["mutuals", "Mutuals", VibesMutuals],
];
const HOLD_MS = 2000;      // how long the line is held to bring the page tabs back
const TABS_VISIBLE_MS = 4000; // tabs hide again after this long without a tap

// The thin line under each page. Hold it for 2 seconds (it fills while you hold) to show the page tabs.
function HoldLine({ onHold }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);
  const stop = () => { clearTimeout(timer.current); setHolding(false); };
  const start = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
    timer.current = setTimeout(() => { setHolding(false); onHold(); }, HOLD_MS);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div
      onPointerDown={start} onPointerUp={stop} onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-x-0 bottom-14 z-20 flex h-9 touch-none select-none items-center px-6"
      aria-label="Hold for two seconds to switch pages"
    >
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/40">
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "none" }}
        />
      </div>
    </div>
  );
}

export default function PanVibes({ onBack, nav }) {
  const { count } = useNotifications();
  const [page, setPage] = useState("foryou");
  const [tabs, setTabs] = useState(true);   // visible when the page opens, then hides
  const [muted, setMuted] = useState(true);

  // hide the tabs again a few seconds after they appear or after a page is picked
  useEffect(() => {
    if (!tabs) return;
    const id = setTimeout(() => setTabs(false), TABS_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [tabs, page]);

  const Current = PAGES.find(([k]) => k === page)[2];
  const icon = "p-2 rounded-2xl text-violet-300";

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white">
      {/* key = switching page starts a fresh feed */}
      <Current key={page} muted={muted} onMute={() => setMuted((m) => !m)} />

      {/* page tabs: hidden while watching */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex justify-center gap-6 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-5 transition-all duration-300 ${
          tabs ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        {PAGES.map(([k, label]) => (
          <button
            key={k} onClick={() => setPage(k)}
            className={`text-lg font-black ${page === k ? "text-white" : "text-white/50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <HoldLine onHold={() => setTabs(true)} />

      {/* same navigation as the feed: Box is the current page */}
      <nav className="absolute inset-x-0 bottom-0 z-20 flex h-14 items-center justify-around bg-black/40 backdrop-blur-xl">
        <button onClick={onBack} className={icon} title="Home"><Home size={24} /></button>
        <button onClick={onBack} className={icon} title="Search"><Search size={24} /></button>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-lg"><Box size={26} /></button>
        <button onClick={() => nav("notifications")} className={`relative ${icon}`} title="Notifications">
          <Bell size={24} />
          {count > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
        <button className={icon} title="Chat"><MessageCircle size={24} /></button>
      </nav>
    </div>
  );
}
