import { useCallback, useEffect, useRef, useState } from "react";
import { Home, Search, Box, Bell, MessageCircle, Plus } from "lucide-react";
import { useNotifications } from "./NotificationsContext";
import { usePosts } from "./PostsContext";
import { useTheme } from "./theme";
import { Avatar } from "./ui";
import CreatePost from "./CreatePost";
import Recents from "./Recents";
import ForYou from "./ForYou";
import VibesMutuals from "./VibesMutuals";
import { starredUserIds } from "./vibesQueries";

const PAGES = [
  ["recents", "Recents", Recents],
  ["foryou", "For You", ForYou],
  ["mutuals", "Mutuals", VibesMutuals],
];
const HOLD_MS = 2000;   // hold the line this long to bring the header, Starred row and tabs back
const OPEN_MS = 6000;   // they hide again after this long (or as soon as you scroll to another video)

// The thin line at the bottom of every card. Hold it for 2 seconds (it fills while you hold).
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
      className="absolute inset-x-8 bottom-1 z-20 flex h-9 touch-none select-none items-center"
      aria-label="Hold for two seconds to show the menu"
    >
      <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/50">
        <div
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "none" }}
        />
      </div>
    </div>
  );
}

export default function PanVibes({ onBack, nav }) {
  const { t } = useTheme();
  const { count } = useNotifications();
  const { users, openUserSheet } = usePosts();
  const [page, setPage] = useState("foryou");
  const [immersive, setImmersive] = useState(false); // true = header / Starred / tabs hidden, video fills the screen
  const [muted, setMuted] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [starred, setStarred] = useState([]);
  const pagerRef = useRef(null);
  const settleTimer = useRef(null);
  const idx = PAGES.findIndex(([k]) => k === page);

  const loadStarred = useCallback(() => { starredUserIds().then(setStarred); }, []);
  useEffect(() => { loadStarred(); }, [loadStarred]);

  // the browsing layout hides itself after a few seconds
  useEffect(() => {
    if (immersive || creating) return;
    const id = setTimeout(() => setImmersive(true), OPEN_MS);
    return () => clearTimeout(id);
  }, [immersive, page, creating]);

  const goTo = useCallback((k, smooth = true) => {
    const el = pagerRef.current;
    const child = el?.children[PAGES.findIndex(([x]) => x === k)];
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // keep the current page centred when the layout changes size
  useEffect(() => {
    const id = requestAnimationFrame(() => goTo(page, false));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive]);

  // swiping sideways: once the scroll stops, the nearest card becomes the current page
  const onPagerScroll = () => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = pagerRef.current;
      if (!el) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      [...el.children].forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setPage(PAGES[best][0]);
    }, 120);
  };
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const pick = (k) => { setPage(k); goTo(k); };
  const starredUsers = starred.map((id) => users[id]).filter(Boolean);
  const icon = "p-2 rounded-2xl text-violet-500";

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col ${t.page} ${t.text}`}>
      {/* header + Starred + tabs: hidden while watching */}
      <div className={`shrink-0 overflow-hidden transition-all duration-300 ${immersive ? "max-h-0 opacity-0" : "max-h-[340px] opacity-100"}`}>
        <header className={`flex items-center gap-2 border-b px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] ${t.line}`}>
          <img src="/panda.png" alt="" className="h-9 w-9 rounded-full object-cover" />
          <h1 className="flex-1 text-xl font-black">Pandora Box</h1>
          <button onClick={() => setCreating(true)} className="grid h-10 w-14 place-items-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white" title="Post a video">
            <Plus size={22} />
          </button>
        </header>

        <div className="px-4 pt-3">
          <p className="text-lg font-black">Starred</p>
          <div className="mt-2 flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            {starredUsers.length === 0 && <p className={`py-4 text-xs ${t.sub}`}>People who post videos show up here.</p>}
            {starredUsers.map((u) => (
              <button key={u.id} onClick={() => openUserSheet(u.id)} className="shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-blue-500 p-[2px]" title={u.username}>
                <span className={`block rounded-full border-2 ${t.dark ? "border-black" : "border-white"}`}><Avatar user={u} size={56} /></span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-6 py-3">
          {PAGES.map(([k, label]) => (
            <button key={k} onClick={() => pick(k)} className={`text-lg ${page === k ? "font-black" : `font-bold ${t.sub}`}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* the three pages side by side: neighbours peek in while browsing, one fills the screen while watching */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={pagerRef} onScroll={onPagerScroll}
          className={`relative flex h-full snap-x snap-mandatory [&::-webkit-scrollbar]:hidden ${immersive ? "overflow-x-hidden" : "overflow-x-auto"}`}
          style={{ scrollbarWidth: "none" }}
        >
          {PAGES.map(([k, , Comp], i) => (
            <div
              key={k}
              className={`h-full shrink-0 snap-center ${immersive ? "w-full" : `w-[86%] px-1.5 ${i === 0 ? "ml-[7%]" : ""} ${i === PAGES.length - 1 ? "mr-[7%]" : ""}`}`}
            >
              <div className={`h-full overflow-hidden bg-black ${immersive ? "" : "rounded-[2rem]"}`}>
                {k === page
                  ? <Comp key={`${k}-${refresh}`} muted={muted} onMute={() => setMuted((m) => !m)} onActivity={() => setImmersive(true)} />
                  : <div className="h-full bg-gradient-to-b from-violet-900/60 to-black" />}
              </div>
            </div>
          ))}
        </div>
        <HoldLine onHold={() => setImmersive(false)} />
      </div>

      {/* page dots */}
      {!immersive && (
        <div className="flex shrink-0 items-center justify-center gap-2.5 py-2.5">
          {PAGES.map(([k]) => (
            <span key={k} className={`rounded-full ${page === k ? "h-4 w-4 bg-gradient-to-br from-fuchsia-500 to-blue-600" : "h-3 w-3 bg-gray-400"}`} />
          ))}
        </div>
      )}

      {/* same navigation as the feed: Box is this page */}
      <nav className={`flex h-14 shrink-0 items-center justify-around border-t ${t.nav} ${t.line}`}>
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

      {creating && (
        <CreatePost
          initialType="video"
          onClose={() => { setCreating(false); loadStarred(); setRefresh((n) => n + 1); }}
        />
      )}
    </div>
  );
}
